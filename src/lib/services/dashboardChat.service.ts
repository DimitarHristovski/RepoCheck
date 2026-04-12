import { listRepoMediumPlusFindings } from "@/lib/store/repository";
import {
  REPOCHECK_SECURITY_AUDITOR_APPENDIX,
  SECURITY_CODE_AUDITOR_SYSTEM,
} from "@/lib/prompts/securityAuditor";

/** Path-based trust tier for auditor STEP 1 (heuristic). */
export function inferPathTrustTier(filePath: string | null): string {
  if (!filePath) return "UNKNOWN";
  const p = filePath.replace(/\\/g, "/").toLowerCase();

  if (
    p.includes("/.next/") ||
    p.endsWith("/.next") ||
    p.includes("/dist/") ||
    p.includes("/build/") ||
    p.includes("vendor-chunks") ||
    /\.min\.(js|mjs|cjs)$/i.test(p)
  ) {
    return "LOW_TRUST_GENERATED";
  }

  if (
    p.endsWith("package.json") ||
    /tailwind\.config\./i.test(p) ||
    /vite\.config\./i.test(p) ||
    /next\.config\./i.test(p) ||
    p.includes(".github/workflows/") ||
    p.includes("/scripts/") ||
    p.includes("server/api/") ||
    (p.includes("/api/") && (p.includes("/route.") || p.includes("/routes/")))
  ) {
    return "HIGH_TRUST_CONFIG_OR_CI";
  }

  if (
    p.startsWith("src/") ||
    p.includes("/src/") ||
    p.includes("/app/") ||
    p.includes("/pages/") ||
    p.includes("/lib/") ||
    p.includes("/components/")
  ) {
    return "MEDIUM_TRUST_APP";
  }

  return "UNCLASSIFIED";
}

/** Full system message: auditor persona + RepoCheck appendix + placeholder for findings block. */
export const DASHBOARD_CHAT_SYSTEM =
  SECURITY_CODE_AUDITOR_SYSTEM + "\n\n" + REPOCHECK_SECURITY_AUDITOR_APPENDIX;

/** Compact snapshot of notable findings for LLM context (metadata / descriptions only). */
export function buildRiskChatFindingsContext(): string {
  const findings = listRepoMediumPlusFindings(40);

  if (!findings.length) {
    return "No medium-or-higher severity findings from repository scans in the local store yet. Run a GitHub/local repo scan or attach files to the copilot.";
  }

  return findings
    .map((f, i) => {
      const path = f.filePath ?? "(no single file path)";
      const tier = inferPathTrustTier(f.filePath);
      const desc = (f.description ?? "").slice(0, 400);
      return [
        `${i + 1}. [${f.severity}] ${f.category} — ${f.title}`,
        `   File: ${path}`,
        `   Trust tier (path heuristic): ${tier}`,
        f.lineHint ? `   Hint: ${f.lineHint}` : null,
        `   Scanner note: ${desc}`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}
