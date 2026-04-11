import { z } from "zod";

export const addApprovedFolderSchema = z.object({
  path: z.string().min(1),
  label: z.string().optional(),
});

export const folderScanSchema = z.object({
  approvedFolderId: z.string().uuid(),
  maxDepth: z.number().int().min(1).max(64).optional().default(32),
});

/** Local by absolute path, or by approved folder + optional path inside it. */
export const repoScanSchema = z.object({
  source: z.union([
    z.object({ type: z.literal("local"), path: z.string().min(1) }),
    z.object({
      type: z.literal("local"),
      approvedFolderId: z.string().uuid(),
      relativePath: z.string().optional(),
    }),
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
  scanDepth: z.number().int().min(1).max(128).optional(),
  maxFileSizeMb: z.number().min(0.1).max(500).optional(),
  ignorePatterns: z.array(z.string()).optional(),
  dangerousExtensions: z.array(z.string()).optional(),
  promptLogging: z.boolean().optional(),
});

export type AddApprovedFolderInput = z.infer<typeof addApprovedFolderSchema>;
export type FolderScanInput = z.infer<typeof folderScanSchema>;
export type RepoScanInput = z.infer<typeof repoScanSchema>;
