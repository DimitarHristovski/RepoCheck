import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { RepoCheckState } from "@/lib/graph/state";
import { analyzeLocalRepo } from "@/lib/services/repoScanner.service";
import { scoreFindings } from "@/lib/services/riskScorer.service";
import { createChatModel } from "@/lib/llm/modelAdapter";
import { REASONING_SYSTEM, buildReasoningUserPayload } from "@/lib/graph/prompts";
import { redactForLLM, truncateForMetadata } from "@/lib/services/redaction.service";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";

const State = Annotation.Root({
  requestType: Annotation<RepoCheckState["requestType"]>(),
  userMessage: Annotation<string | undefined>(),
  repoLocalPath: Annotation<string | undefined>(),
  inventory: Annotation<RepoCheckState["inventory"]>(),
  heuristicFindings: Annotation<RepoCheckState["heuristicFindings"]>(),
  plannedActions: Annotation<RepoCheckState["plannedActions"]>(),
  riskScore: Annotation<RepoCheckState["riskScore"]>(),
  llmNarrative: Annotation<RepoCheckState["llmNarrative"]>(),
  safetyBlocked: Annotation<boolean | undefined>(),
  safetyReason: Annotation<string | undefined>(),
  errors: Annotation<string[] | undefined>(),
  privacyMetadataOnly: Annotation<boolean>(),
});

type S = typeof State.State;

async function staticScanNode(state: S): Promise<Partial<S>> {
  if (state.safetyBlocked) return {};

  const outFindings: NonNullable<RepoCheckState["heuristicFindings"]> = [];
  const errs: string[] = [];

  if (state.repoLocalPath) {
    try {
      const { findings } = analyzeLocalRepo(state.repoLocalPath);
      outFindings.push(...findings);
    } catch (e) {
      errs.push(String(e));
    }
  }

  return {
    heuristicFindings: outFindings,
    errors: errs,
  };
}

async function scoreNode(state: S): Promise<Partial<S>> {
  const findings = state.heuristicFindings ?? [];
  const scored = scoreFindings(findings);
  return {
    riskScore: {
      totalScore: scored.totalScore,
      confidence: scored.confidence,
      label: scored.label,
      subscores: scored.subscores,
      rationale: scored.rationale,
    },
  };
}

async function llmNode(state: S): Promise<Partial<S>> {
  const model = createChatModel();
  if (!model) {
    return {
      llmNarrative: {
        summary: "LLM provider disabled or not configured.",
        evidenceBullets: [],
        inferenceBullets: [],
        recommendedNextStep: "Review static findings manually.",
        userImpact: "No cloud/local model narration available.",
      },
    };
  }
  const findings = state.heuristicFindings ?? [];
  const rs = state.riskScore;
  const userPayload = buildReasoningUserPayload({
    riskLabel: rs?.label ?? "unknown",
    score: rs?.totalScore ?? 0,
    findingsSummary: findings.map((f) => ({
      title: f.title,
      severity: f.severity,
      category: f.category,
    })),
    privacyMetadataOnly: state.privacyMetadataOnly ?? true,
  });
  const content = redactForLLM(
    truncateForMetadata(userPayload, state.privacyMetadataOnly ? 8000 : 12_000)
  );
  try {
    const res = await model.invoke([
      new SystemMessage(REASONING_SYSTEM),
      new HumanMessage(content),
    ]);
    const raw =
      typeof res.content === "string"
        ? res.content
        : JSON.stringify(res.content);
    const parsed = z
      .object({
        summary: z.string(),
        evidenceBullets: z.array(z.string()),
        inferenceBullets: z.array(z.string()),
        recommendedNextStep: z.string(),
        userImpact: z.string(),
      })
      .safeParse(JSON.parse(raw));
    if (parsed.success) return { llmNarrative: parsed.data };
  } catch {
    /* use fallback */
  }
  return {
    llmNarrative: {
      summary: "Could not parse LLM JSON; see static findings and scores.",
      evidenceBullets: (state.riskScore?.rationale ?? []).slice(0, 12),
      inferenceBullets: [],
      recommendedNextStep: "Inspect flagged files manually or in a sandbox.",
      userImpact: "Unknown without successful model output.",
    },
  };
}

async function passthrough(): Promise<Partial<S>> {
  return {};
}

export function buildRepoCheckGraph() {
  return new StateGraph(State)
    .addNode("static_scan", staticScanNode)
    .addNode("score", scoreNode)
    .addNode("llm", llmNode)
    .addNode("done", passthrough)
    .addEdge(START, "static_scan")
    .addEdge("static_scan", "score")
    .addEdge("score", "llm")
    .addEdge("llm", "done")
    .addEdge("done", END)
    .compile();
}

export async function runRepoCheckWorkflow(
  initial: Partial<RepoCheckState> & {
    privacyMetadataOnly: boolean;
  }
) {
  const graph = buildRepoCheckGraph();
  return graph.invoke({
    requestType: initial.requestType ?? "repo_scan",
    userMessage: initial.userMessage,
    repoLocalPath: initial.repoLocalPath,
    privacyMetadataOnly: initial.privacyMetadataOnly,
    inventory: initial.inventory,
    heuristicFindings: initial.heuristicFindings,
    errors: initial.errors,
  } as S);
}
