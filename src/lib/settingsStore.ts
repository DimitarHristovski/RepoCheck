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
