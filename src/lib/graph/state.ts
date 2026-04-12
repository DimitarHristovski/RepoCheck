import { z } from "zod";
import type { HeuristicFinding } from "@/lib/types/findings";
import type {
  PersistedInventoryItem,
  PersistedPlannedAction,
} from "@/lib/types/persistedScan";

export const graphRequestTypeSchema = z.enum(["repo_scan"]);

export type GraphRequestType = z.infer<typeof graphRequestTypeSchema>;

export const repoCheckStateSchema = z.object({
  requestType: graphRequestTypeSchema,
  userMessage: z.string().optional(),
  repoLocalPath: z.string().optional(),
  inventory: z.array(z.custom<PersistedInventoryItem>()).optional(),
  heuristicFindings: z.array(z.custom<HeuristicFinding>()).optional(),
  plannedActions: z.array(z.custom<PersistedPlannedAction>()).optional(),
  riskScore: z
    .object({
      totalScore: z.number(),
      confidence: z.number(),
      label: z.string(),
      subscores: z.record(z.number()),
      rationale: z.array(z.string()),
    })
    .optional(),
  llmNarrative: z
    .object({
      summary: z.string(),
      evidenceBullets: z.array(z.string()),
      inferenceBullets: z.array(z.string()),
      recommendedNextStep: z.string(),
      userImpact: z.string(),
    })
    .optional(),
  safetyBlocked: z.boolean().optional(),
  safetyReason: z.string().optional(),
  errors: z.array(z.string()).optional(),
});

export type RepoCheckState = z.infer<typeof repoCheckStateSchema>;
