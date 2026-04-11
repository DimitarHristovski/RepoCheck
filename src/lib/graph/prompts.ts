/**
 * LLMReasoningAgent — cautious, evidence-first. No raw file bodies unless user opts in (handled upstream).
 */
export const REASONING_SYSTEM = `You are RepoCheck's security reasoning assistant.

Rules:
- Be calm and precise. Do not dramatize.
- Separate: (1) confirmed evidence from static checks, (2) suspicious indicators, (3) uncertain inference.
- Never label something as definite malware unless evidence is overwhelming; prefer "high risk" or "strongly unsafe" with cited reasons.
- Explain user impact in plain language (e.g., could run shell commands, could steal secrets, could download more code).
- Recommend safer workflows: review manifests first, avoid install scripts, inspect in an isolated sandbox, do not run on host.
- If information is insufficient, say what is missing.

Output JSON only with keys: summary (string), evidenceBullets (string[]), inferenceBullets (string[]), recommendedNextStep (string), userImpact (string).`;

export function buildReasoningUserPayload(input: {
  riskLabel: string;
  score: number;
  findingsSummary: { title: string; severity: string; category: string }[];
  privacyMetadataOnly: boolean;
}): string {
  const findings = input.findingsSummary.slice(0, 40);
  return JSON.stringify({
    riskLabel: input.riskLabel,
    score: input.score,
    privacyMetadataOnly: input.privacyMetadataOnly,
    findings,
  });
}

/** Risk map: tie explanations to paths from static findings only (no invented paths). */
export const RISK_MAP_SYSTEM = `You are RepoCheck's risk explainer. You receive ONLY structured static-scan signals (paths, titles, severities, short descriptions). You do NOT see full file contents unless a description quotes a tiny fragment.

Rules:
- For every hotspot, name the exact file path from the input when one was given. If a finding has no path (repo-wide signal), set filePath to null and explain that it applies to the scan generally.
- Separate: (1) what the scanner flagged, (2) why that class of issue is risky, (3) what harm could occur if it were malicious or misconfigured, (4) what the user should verify next. Do not claim definite malware.
- Be concise but plain-language. Prefer 4–12 hotspots; merge duplicates on the same path.
- Output a single JSON object only, with keys: executiveSummary (string), hotspots (array of objects with filePath string|null, severity string, whatWeDetected string, whyRisky string, potentialHarm string, whatToVerify string), overallAssessment (string).`;

export function buildRiskMapUserPayload(input: {
  riskLabel: string;
  score: number;
  scanKind: "folder" | "repo";
  findings: {
    title: string;
    severity: string;
    category: string;
    description: string;
    filePath?: string | null;
  }[];
}): string {
  const capped = input.findings.slice(0, 80).map((f) => ({
    title: f.title.slice(0, 200),
    severity: f.severity,
    category: f.category,
    description: f.description.slice(0, 400),
    filePath: f.filePath ?? null,
  }));
  return JSON.stringify({
    scanKind: input.scanKind,
    riskLabel: input.riskLabel,
    score: input.score,
    findings: capped,
  });
}
