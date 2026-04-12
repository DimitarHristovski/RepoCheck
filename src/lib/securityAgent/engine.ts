/**
 * ## Rule engine design (pipeline)
 *
 * `signals → context (file trust + adjustments) → score (base + combinations) → verdict (thresholds + hard rules)`
 *
 * - **Signals**: deterministic regex / JSON hooks over file text; each hit maps to a `SignalKind` and base points.
 * - **Context**: `FileTrustLevel` down-weights generated bundles; optional bonuses for obfuscation in handwritten source.
 * - **Score**: sum of per-signal adjusted points + one-time repo-level combination bonuses.
 * - **Verdict**: map total to `CLEAN` … `CONFIRMED_MALICIOUS`, then apply **hard caps** (e.g. generated-only, eval-only, env-only).
 *
 * This module is intentionally **conservative**: it prefers `NEEDS_REVIEW` over false accusations; it does not start servers or run user code.
 */

import {
  BASE_SIGNAL_POINTS,
  DEFAULT_GENERATED_MARKERS,
  DEFAULT_SAFE_DOMAINS,
  TRUST_DELTA,
} from "./config";
import { detectCombinations } from "./combinations";
import type {
  AgentFileInput,
  ContextAnalysisSection,
  FileDecisionSlice,
  FileTrustLevel,
  KeyFindingRow,
  ScoredSignal,
  SecurityAgentOptions,
  SecurityAgentReport,
  SignalKind,
  SignalMatch,
} from "./types";
import { extractPackageJsonScriptSignals, extractSignalsFromContent } from "./signals";
import { inferFileTrustLevel } from "./trust";
import { applyHardRules, confidenceFromEvidence } from "./verdict";

function dedupeKinds(matches: SignalMatch[]): SignalMatch[] {
  const seen = new Set<SignalKind>();
  const out: SignalMatch[] = [];
  for (const m of matches) {
    if (seen.has(m.kind)) continue;
    seen.add(m.kind);
    out.push(m);
  }
  return out;
}

function isGeneratedPath(p: string, markers: string[]): boolean {
  const n = p.replace(/\\/g, "/").toLowerCase();
  return markers.some((m) => n.includes(m.toLowerCase()));
}

function scoreSignalsForFile(
  path: string,
  trustLevel: FileTrustLevel,
  matches: SignalMatch[],
  generatedMarkers: string[]
): { scored: ScoredSignal[]; fileBonus: number } {
  let fileBonus = 0;
  const trustDelta = TRUST_DELTA[trustLevel];
  const generated = isGeneratedPath(path, generatedMarkers);

  const hasUnknownOrRiskUrl = matches.some(
    (m) =>
      m.kind === "URL_UNKNOWN_DOMAIN" ||
      m.kind === "URL_IP_LITERAL" ||
      m.kind === "URL_DISCORD_TELEGRAM_WEBHOOK"
  );
  const hasNetClient = matches.some((m) =>
    ["FETCH", "AXIOS", "HTTP_REQUEST_LEGACY", "POST_OUTBOUND"].includes(m.kind)
  );
  if (hasNetClient && !hasUnknownOrRiskUrl) {
    fileBonus -= 2;
  }

  const handwrittenObfuscation =
    (trustLevel === "HIGH_PRIORITY" || trustLevel === "MEDIUM_PRIORITY") &&
    !generated &&
    matches.some((m) =>
      ["HEAVY_ESCAPES", "STRING_RECONSTRUCT_SPLIT_JOIN"].includes(m.kind)
    );
  if (handwrittenObfuscation) {
    fileBonus += 4;
  }

  const scored: ScoredSignal[] = matches.map((match) => {
    const base = BASE_SIGNAL_POINTS[match.kind] ?? 0;
    let extra = trustDelta;
    if (generated && trustLevel !== "LOW_PRIORITY") {
      extra += -2;
    }
    const adjustedSubtotal = Math.max(0, base + extra);
    return {
      match,
      trustLevel,
      basePoints: base,
      trustAdjustment: extra,
      adjustedSubtotal,
      explanation: `${match.kind} in ${trustLevel} file (${base} base, context Δ${extra >= 0 ? "+" : ""}${extra})`,
    };
  });

  return { scored, fileBonus };
}

function buildContextAnalysis(
  reportSlices: FileDecisionSlice[],
  combinations: { id: string; explanation: string }[]
): ContextAnalysisSection[] {
  const sections: ContextAnalysisSection[] = [];
  const high = reportSlices.filter((f) => f.trustLevel === "HIGH_PRIORITY");
  const low = reportSlices.filter((f) => f.trustLevel === "LOW_PRIORITY");

  if (high.some((f) => f.signals.length > 0)) {
    sections.push({
      bucket: "dangerous",
      summary:
        "High-impact paths (package.json, config, CI, scripts, server) contain security-relevant primitives — review intent carefully.",
      relatedPaths: high.filter((f) => f.signals.length).map((f) => f.path),
    });
  }

  if (low.some((f) => f.signals.length > 0)) {
    sections.push({
      bucket: "expected_behavior",
      summary:
        "Generated or minified bundles often contain strings that resemble obfuscation or dynamic execution; treat as weak evidence unless mirrored in first-party source.",
      relatedPaths: low.filter((f) => f.signals.length).map((f) => f.path),
    });
  }

  if (combinations.some((c) => c.id === "SECRET_EXFIL_UNKNOWN_DEST")) {
    sections.push({
      bucket: "strong_evidence_malicious",
      summary:
        "Credential/env patterns coincide with outbound requests to non-allowlisted hosts — classic exfiltration staging; validate destinations and payloads.",
      relatedPaths: [],
    });
  } else if (combinations.length > 0) {
    sections.push({
      bucket: "suspicious_but_explainable",
      summary:
        "Correlated signals increase risk but may still fit legitimate automation (CI, migrations). Confirm with owners and runtime behavior.",
      relatedPaths: [],
    });
  }

  if (sections.length === 0) {
    sections.push({
      bucket: "expected_behavior",
      summary: "No strong correlated patterns detected in scanned files.",
      relatedPaths: [],
    });
  }

  return sections;
}

function finalReasoningText(verdict: string, score: number, caps: string[]): string {
  const capNote =
    caps.length > 0 ? ` Hard-rule adjustments: ${caps.join(" ")}` : "";
  switch (verdict) {
    case "CLEAN":
      return `Aggregate score ${score} sits in the clean band; patterns are absent or negligible.${capNote}`;
    case "LOW_SUSPICIOUS":
      return `Score ${score} shows mild signals typical of many benign projects (e.g. env reads or minified code). No strong correlation.${capNote}`;
    case "NEEDS_REVIEW":
      return `Score ${score} warrants human review: multiple primitives or combinations merit context (build vs runtime, trusted vs unknown endpoints).${capNote}`;
    case "LIKELY_MALICIOUS":
      return `Score ${score} indicates several high-risk correlations (execution + network, hooks + shell, or persistence). Treat as suspicious until disproven.${capNote}`;
    case "CONFIRMED_MALICIOUS":
      return `Score ${score} exceeds the high threshold with corroborating combinations — consistent with malware techniques (exfil, staging, persistence).${capNote}`;
    default:
      return `Verdict ${verdict} (score ${score}).${capNote}`;
  }
}

export function runSecurityAgent(
  files: AgentFileInput[],
  options?: SecurityAgentOptions
): SecurityAgentReport {
  const safeDomains = options?.safeDomains ?? DEFAULT_SAFE_DOMAINS;
  const generatedMarkers =
    options?.generatedPathMarkers ?? DEFAULT_GENERATED_MARKERS;

  const perFile: FileDecisionSlice[] = [];
  const allScored: ScoredSignal[] = [];

  for (const file of files) {
    const { level, rationale } = inferFileTrustLevel(file.path);
    const rawMatches = [
      ...extractSignalsFromContent(file.path, file.content, safeDomains),
      ...extractPackageJsonScriptSignals(file.path, file.content),
    ];
    const matches = dedupeKinds(rawMatches);
    const { scored, fileBonus } = scoreSignalsForFile(
      file.path,
      level,
      matches,
      generatedMarkers
    );

    const fileSubtotal =
      scored.reduce((a, s) => a + s.adjustedSubtotal, 0) + fileBonus;

    perFile.push({
      path: file.path,
      trustLevel: level,
      trustRationale: rationale,
      signals: scored,
      fileSubtotal,
    });
    allScored.push(...scored);
  }

  const combos = detectCombinations(allScored);
  const comboPoints = combos.reduce((a, c) => a + c.points, 0);
  const rawScore =
    perFile.reduce((a, f) => a + f.fileSubtotal, 0) + comboPoints;

  const perFileMeta = perFile.map((f) => ({
    path: f.path,
    trust: f.trustLevel,
    kinds: new Set(f.signals.map((s) => s.match.kind)),
  }));

  const hard = applyHardRules({
    rawScore,
    perFileSignals: perFileMeta,
    combinationIds: new Set(combos.map((c) => c.id)),
  });

  const verdict = hard.verdict;
  const confidence = confidenceFromEvidence({
    fileCountWithSignals: perFile.filter((f) => f.signals.length > 0).length,
    highTrustFileCount: perFile.filter(
      (f) => f.trustLevel === "HIGH_PRIORITY" && f.signals.length > 0
    ).length,
    combinationCount: combos.length,
    totalSignals: allScored.length,
  });

  const keyFindings: KeyFindingRow[] = perFile
    .filter((f) => f.signals.length > 0)
    .map((f) => ({
      filePath: f.path,
      fileTrustLevel: f.trustLevel,
      signalTypes: f.signals.map((s) => s.match.kind),
      scoreContribution: f.fileSubtotal,
      explanation: f.trustRationale,
    }))
    .sort((a, b) => b.scoreContribution - a.scoreContribution)
    .slice(0, 24);

  const contextAnalysis = buildContextAnalysis(perFile, combos);
  const finalReasoning = finalReasoningText(verdict, hard.score, hard.capsApplied);

  const pipelineNotes = [
    "Pipeline: extract signals → trust-weight → sum → combinations → verdict → hard rules.",
    "This engine does not execute repository code or install dependencies.",
  ];
  if (options?.debug) {
    pipelineNotes.push(`Raw score before caps: ${rawScore}`);
  }

  return {
    summary: {
      verdict,
      confidence,
      totalScore: hard.score,
      rawScoreBeforeCaps: rawScore,
      capsApplied: hard.capsApplied,
    },
    keyFindings,
    contextAnalysis,
    finalReasoning,
    perFile,
    combinationHits: combos,
    pipelineNotes,
  };
}

