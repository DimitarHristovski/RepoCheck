import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { RISK_MAP_SYSTEM, buildRiskMapUserPayload } from "@/lib/graph/prompts";
import { createChatModel } from "@/lib/llm/modelAdapter";
import { logger } from "@/lib/logger";
import type { RiskScoreResult } from "@/lib/services/riskScorer.service";
import type { HeuristicFinding } from "@/lib/types/findings";

export const llmRiskExplanationSchema = z.object({
  executiveSummary: z.string(),
  hotspots: z.array(
    z.object({
      filePath: z.string().nullable(),
      severity: z.string(),
      whatWeDetected: z.string(),
      whyRisky: z.string(),
      potentialHarm: z.string(),
      whatToVerify: z.string(),
    })
  ),
  overallAssessment: z.string(),
});

export type LlmRiskExplanation = z.infer<typeof llmRiskExplanationSchema>;

export type LlmRiskExplainResult =
  | { ok: true; data: LlmRiskExplanation }
  | { ok: false; reason: "no_model" | "parse_error"; message: string };

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/m);
  const body = fence ? fence[1]!.trim() : trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(body.slice(start, end + 1)) as unknown;
  }
  return JSON.parse(body) as unknown;
}

export async function explainRisksWithLlm(input: {
  findings: HeuristicFinding[];
  risk: RiskScoreResult;
  scanKind: "folder" | "repo";
}): Promise<LlmRiskExplainResult> {
  const model = createChatModel();
  if (!model) {
    return {
      ok: false,
      reason: "no_model",
      message: "No LLM configured. Set OPENAI_API_KEY or use Ollama in Settings.",
    };
  }

  const user = buildRiskMapUserPayload({
    riskLabel: input.risk.label,
    score: input.risk.totalScore,
    scanKind: input.scanKind,
    findings: input.findings.map((f) => ({
      title: f.title,
      severity: f.severity,
      category: f.category,
      description: f.description,
      filePath: f.filePath ?? null,
    })),
  });

  try {
    const res = await model.invoke([
      new SystemMessage(RISK_MAP_SYSTEM),
      new HumanMessage(user),
    ]);
    const raw =
      typeof res.content === "string"
        ? res.content
        : JSON.stringify(res.content);
    const parsed = extractJsonObject(raw);
    const data = llmRiskExplanationSchema.parse(parsed);
    return { ok: true, data };
  } catch (e) {
    logger.warn({ err: e }, "llm risk explain failed");
    return {
      ok: false,
      reason: "parse_error",
      message: e instanceof Error ? e.message : String(e),
    };
  }
}
