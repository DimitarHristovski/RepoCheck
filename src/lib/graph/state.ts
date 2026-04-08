import { z } from "zod";
import type { HeuristicFinding } from "@/lib/types/findings";
import type { InventoryItem } from "@/lib/services/fileScanner.service";
import type { PlannedAction } from "@/lib/services/organizationPlanner.service";

export const graphRequestTypeSchema = z.enum([
  "file_organization",
  "folder_protection",
  "repo_scan",
  "mixed",
]);

export type GraphRequestType = z.infer<typeof graphRequestTypeSchema>;

export const repoCheckStateSchema = z.object({
  requestType: graphRequestTypeSchema,
  userMessage: z.string().optional(),
  approvedFolderPath: z.string().optional(),
  approvedRoots: z.array(z.string()),
  repoLocalPath: z.string().optional(),
  inventory: z.array(z.custom<InventoryItem>()).optional(),
  heuristicFindings: z.array(z.custom<HeuristicFinding>()).optional(),
  plannedActions: z.array(z.custom<PlannedAction>()).optional(),
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
