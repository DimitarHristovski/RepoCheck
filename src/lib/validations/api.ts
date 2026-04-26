import { z } from "zod";

/** Local absolute path to repo root, or public GitHub repo (ZIP download, not git). */
export const repoScanSchema = z.object({
  source: z.union([
    z.object({ type: z.literal("local"), path: z.string().min(1) }),
    z.object({
      type: z.literal("url"),
      /** Raw paste: HTTPS URL, owner/repo, SSH, or github.com/... — normalized server-side. */
      url: z.string().min(1).max(2048),
      branch: z.string().max(256).optional(),
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
  guardian: z
    .object({
      enabled: z.boolean().optional(),
      githubRepos: z.array(z.string()).optional(),
      localWatchDirs: z.array(z.string()).optional(),
      pollMs: z.number().int().min(60_000).max(86_400_000).optional(),
      alertMinSeverity: z.enum(["critical", "high", "medium"]).optional(),
      githubToken: z.string().max(512).optional(),
    })
    .optional(),
});

export type RepoScanInput = z.infer<typeof repoScanSchema>;
