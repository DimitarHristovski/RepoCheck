import { z } from "zod";
import {
  readAppSettingsBlob,
  writeAppSettingsBlob,
} from "@/lib/store/repository";

export const appSettingsSchema = z.object({
  modelProvider: z.enum(["openai", "ollama", "none"]).default("none"),
  privacyModeMetadataOnly: z.boolean().default(true),
  localOnlyMode: z.boolean().default(true),
  promptLogging: z.boolean().default(false),
  guardian: z
    .object({
      enabled: z.boolean().default(true),
      githubRepos: z.array(z.string()).default([]),
      localWatchDirs: z.array(z.string()).default([]),
      pollMs: z.number().int().min(60_000).max(86_400_000).default(300_000),
      alertMinSeverity: z.enum(["critical", "high", "medium"]).default("high"),
      githubToken: z.string().max(512).default(""),
    })
    .default({}),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;
export type AppSettingsPatch = Partial<Omit<AppSettings, "guardian">> & {
  guardian?: Partial<AppSettings["guardian"]>;
};

const defaults: AppSettings = appSettingsSchema.parse({});

export function getAppSettings(): AppSettings {
  const blob = readAppSettingsBlob();
  if (blob == null) return defaults;
  const parsed = appSettingsSchema.safeParse(blob);
  return parsed.success ? parsed.data : defaults;
}

export function setAppSettings(patch: AppSettingsPatch): AppSettings {
  const current = getAppSettings();
  const next = appSettingsSchema.parse({
    ...current,
    ...patch,
    guardian: {
      ...current.guardian,
      ...(patch.guardian ?? {}),
    },
  });
  writeAppSettingsBlob(next);
  return next;
}
