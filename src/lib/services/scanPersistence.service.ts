import { randomUUID } from "crypto";
import { mergeScanSessionMetadata, persistFolderScan } from "@/lib/store/repository";
import { scoreFindings } from "@/lib/services/riskScorer.service";
import { explainRisksWithLlm } from "@/lib/services/llmRiskExplain.service";
import type { HeuristicFinding } from "@/lib/types/findings";
import type { LlmRiskExplainResult } from "@/lib/services/llmRiskExplain.service";

export { persistFolderScan, persistRepoRecord } from "@/lib/store/repository";

/**
 * Persist findings, risk row, one manual-review proposed action, then attach LLM explanation metadata.
 * Used for GitHub/repo scans and dashboard upload scans so Dashboard, Findings, and Action Center stay in sync.
 */
export async function finalizeScanSession(input: {
  findings: HeuristicFinding[];
  sessionType: "repo" | "upload";
  repositoryId: string | null;
  plannedDescription: string;
  plannedPayload?: Record<string, unknown>;
  extraSessionMetadata?: Record<string, unknown> | null;
}): Promise<{ sessionId: string; llm: LlmRiskExplainResult }> {
  const risk = scoreFindings(input.findings);
  const planId = randomUUID();
  const { sessionId } = persistFolderScan({
    approvedFolderId: null,
    items: [],
    heuristicFindings: input.findings,
    risk,
    planned: [
      {
        id: planId,
        type: "manual_review",
        description: input.plannedDescription,
        payload: {
          ...input.plannedPayload,
          planId,
          sessionType: input.sessionType,
        },
      },
    ],
    sessionType: input.sessionType,
    repositoryId: input.repositoryId,
  });

  const llm = await explainRisksWithLlm({
    findings: input.findings,
    risk,
    scanKind: input.sessionType,
  });

  mergeScanSessionMetadata(sessionId, {
    llmRiskExplanation: llm.ok ? llm.data : null,
    llmRiskExplanationMeta: llm.ok
      ? null
      : { reason: llm.reason, message: llm.message },
    ...(input.extraSessionMetadata ?? {}),
  });

  return { sessionId, llm };
}
