import type { ConfidenceLevel, SecurityVerdict } from "./types";
import { VERDICT_THRESHOLDS } from "./config";

export function verdictFromScore(score: number): SecurityVerdict {
  const s = Math.max(0, Math.round(score));
  if (s <= VERDICT_THRESHOLDS.CLEAN_MAX) return "CLEAN";
  if (s <= VERDICT_THRESHOLDS.LOW_SUSPICIOUS_MAX) return "LOW_SUSPICIOUS";
  if (s <= VERDICT_THRESHOLDS.NEEDS_REVIEW_MAX) return "NEEDS_REVIEW";
  if (s <= VERDICT_THRESHOLDS.LIKELY_MALICIOUS_MAX) return "LIKELY_MALICIOUS";
  return "CONFIRMED_MALICIOUS";
}

export function confidenceFromEvidence(input: {
  fileCountWithSignals: number;
  highTrustFileCount: number;
  combinationCount: number;
  totalSignals: number;
}): ConfidenceLevel {
  const { fileCountWithSignals, highTrustFileCount, combinationCount, totalSignals } =
    input;
  if (combinationCount >= 2 && highTrustFileCount >= 1 && totalSignals >= 6) {
    return "HIGH";
  }
  if (fileCountWithSignals >= 2 && (combinationCount >= 1 || totalSignals >= 5)) {
    return "MEDIUM";
  }
  return "LOW";
}

const OBF_ONLY: Set<string> = new Set([
  "EVAL",
  "FUNCTION_CONSTRUCTOR",
  "BASE64_DECODE",
  "STRING_RECONSTRUCT_SPLIT_JOIN",
  "HEAVY_ESCAPES",
]);

const ENV_ONLY: Set<string> = new Set([
  "PROCESS_ENV",
  "DOTENV_READ",
  "TOKEN_KEY_COOKIE_PATTERN",
]);

/**
 * Hard rules §6 — returns capped score and verdict; may downgrade verdict.
 */
export function applyHardRules(input: {
  rawScore: number;
  perFileSignals: { path: string; trust: string; kinds: Set<string> }[];
  combinationIds: Set<string>;
}): { score: number; verdict: SecurityVerdict; capsApplied: string[] } {
  const caps: string[] = [];
  let score = input.rawScore;
  let verdict = verdictFromScore(score);

  const allKinds = new Set<string>();
  for (const f of input.perFileSignals) {
    for (const k of f.kinds) allKinds.add(k);
  }

  const filesWithSignals = input.perFileSignals.filter((f) => f.kinds.size > 0);
  const onlyLowTrust =
    filesWithSignals.length > 0 &&
    filesWithSignals.every((f) => f.trust === "LOW_PRIORITY");

  if (onlyLowTrust) {
    caps.push(
      "Never classify from generated bundles alone: capped at NEEDS_REVIEW."
    );
    const maxS = VERDICT_THRESHOLDS.NEEDS_REVIEW_MAX;
    if (score > maxS) score = maxS;
    verdict = verdictFromScore(score);
    if (verdict === "LIKELY_MALICIOUS" || verdict === "CONFIRMED_MALICIOUS") {
      score = maxS;
      verdict = "NEEDS_REVIEW";
    }
  }

  const onlyObfuscation =
    [...allKinds].length > 0 && [...allKinds].every((k) => OBF_ONLY.has(k));
  if (
    onlyObfuscation &&
    allKinds.size > 0 &&
    !input.combinationIds.has("BASE64_PLUS_EVAL")
  ) {
    caps.push("Eval/obfuscation-only signals: capped at LOW_SUSPICIOUS.");
    const maxS = VERDICT_THRESHOLDS.LOW_SUSPICIOUS_MAX;
    if (score > maxS) score = maxS;
    verdict = verdictFromScore(score);
  }

  const onlyEnv =
    [...allKinds].every((k) => ENV_ONLY.has(k) || k === "PATH_MODULE") &&
    [...allKinds].some((k) => ENV_ONLY.has(k)) &&
    !input.combinationIds.has("ENV_PLUS_NETWORK") &&
    !input.combinationIds.has("SECRET_EXFIL_UNKNOWN_DEST");

  if (onlyEnv && filesWithSignals.length > 0) {
    caps.push("Environment access alone: capped at LOW_SUSPICIOUS.");
    const maxS = VERDICT_THRESHOLDS.LOW_SUSPICIOUS_MAX;
    if (score > maxS) score = maxS;
    verdict = verdictFromScore(score);
  }

  const onlyNetworkSafeCase =
    [...allKinds].every(
      (k) =>
        networkOnlyKinds.has(k) ||
        k === "PATH_MODULE" ||
        k === "FS_MODULE" ||
        k === "OS_MODULE"
    ) && [...allKinds].some((k) => networkOnlyKinds.has(k));

  if (
    onlyNetworkSafeCase &&
    !allKinds.has("URL_UNKNOWN_DOMAIN") &&
    !allKinds.has("URL_IP_LITERAL") &&
    !allKinds.has("URL_DISCORD_TELEGRAM_WEBHOOK")
  ) {
    caps.push("Allowlisted-style network usage: capped at NEEDS_REVIEW.");
    const maxS = VERDICT_THRESHOLDS.NEEDS_REVIEW_MAX;
    if (score > maxS) score = maxS;
    verdict = verdictFromScore(score);
  }

  return { score, verdict, capsApplied: caps };
}

const networkOnlyKinds = new Set<string>([
  "FETCH",
  "AXIOS",
  "HTTP_REQUEST_LEGACY",
  "POST_OUTBOUND",
]);
