import { z } from "zod";

/** Local absolute path to repo root, or clone from URL. */
export const repoScanSchema = z.object({
  source: z.union([
    z.object({ type: z.literal("local"), path: z.string().min(1) }),
    z.object({
      type: z.literal("url"),
      url: z.string().url(),
      branch: z.string().optional(),
    }),
  ]),
});

export const proposeActionsSchema = z.object({
  sessionId: z.string().uuid(),
  actionIds: z.array(z.string().uuid()).optional(),
});

export const executeActionSchema = z.object({
  proposedActionId: z.string().uuid(),
  confirm: z.literal(true),
});

export const settingsPatchSchema = z.object({
  modelProvider: z.enum(["openai", "ollama", "none"]).optional(),
  privacyModeMetadataOnly: z.boolean().optional(),
  localOnlyMode: z.boolean().optional(),
  promptLogging: z.boolean().optional(),
});

export type RepoScanInput = z.infer<typeof repoScanSchema>;
