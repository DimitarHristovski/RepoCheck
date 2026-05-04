import { listRepoMediumPlusFindings, resolveScanLabelForSession } from "@/lib/store/repository";
import { inferPathTrustTier } from "@/lib/pathTrustTier";
import {
  REPOCHECK_SECURITY_AUDITOR_APPENDIX,
  SECURITY_CODE_AUDITOR_SYSTEM,
} from "@/lib/prompts/securityAuditor";

export { inferPathTrustTier } from "@/lib/pathTrustTier";

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
      const sourceLabel = resolveScanLabelForSession(f.sessionId);
      return [
        `${i + 1}. [${f.severity}] ${f.category} — ${f.title}`,
        `   Scanned source / repository: ${sourceLabel}`,
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
