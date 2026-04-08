import { z } from "zod";
import {
  readAppSettingsBlob,
  writeAppSettingsBlob,
} from "@/lib/store/repository";

export const appSettingsSchema = z.object({
  modelProvider: z.enum(["openai", "ollama", "none"]).default("none"),
  privacyModeMetadataOnly: z.boolean().default(true),
  localOnlyMode: z.boolean().default(true),
  scanDepth: z.number().int().min(1).max(128).default(32),
  maxFileSizeMb: z.number().min(0.1).max(500).default(2),
  ignorePatterns: z.array(z.string()).default(["node_modules", ".git"]),
  dangerousExtensions: z
    .array(z.string())
    .default([".exe", ".scr", ".bat", ".cmd", ".ps1"]),
  promptLogging: z.boolean().default(false),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;

const defaults: AppSettings = appSettingsSchema.parse({});

export function getAppSettings(): AppSettings {
  const blob = readAppSettingsBlob();
  if (blob == null) return defaults;
  const parsed = appSettingsSchema.safeParse(blob);
  return parsed.success ? parsed.data : defaults;
}

export function setAppSettings(patch: Partial<AppSettings>): AppSettings {
  const current = getAppSettings();
  const next = appSettingsSchema.parse({ ...current, ...patch });
  writeAppSettingsBlob(next);
  return next;
}
