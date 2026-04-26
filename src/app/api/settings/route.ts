import { NextResponse } from "next/server";
import { settingsPatchSchema } from "@/lib/validations/api";
import { getAppSettings, setAppSettings } from "@/lib/settingsStore";
import { writeAuditLog } from "@/lib/services/auditLog.service";
import { getConfig, resolveOpenAiApiKey } from "@/lib/config";
import {
  getGuardianStatus,
  restartGuardianService,
  startGuardianService,
} from "@/lib/services/guardian.service";

export const runtime = "nodejs";

export function GET() {
  startGuardianService();
  const guardian = getGuardianStatus();
  const cfg = getConfig();
  return NextResponse.json({
    settings: getAppSettings(),
    runtime: {
      effectiveModelProvider: cfg.REPOCHECK_MODEL_PROVIDER,
      hasOpenAiKey: Boolean(resolveOpenAiApiKey()),
      hasOpenAiBaseUrl: Boolean(process.env.OPENAI_BASE_URL),
    },
    guardian,
  });
}

export async function PATCH(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = settingsPatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const next = setAppSettings(parsed.data);
  restartGuardianService();
  writeAuditLog({ actor: "user", action: "settings_update" });
  const cfg = getConfig();
  return NextResponse.json({
    settings: next,
    runtime: {
      effectiveModelProvider: cfg.REPOCHECK_MODEL_PROVIDER,
      hasOpenAiKey: Boolean(resolveOpenAiApiKey()),
      hasOpenAiBaseUrl: Boolean(process.env.OPENAI_BASE_URL),
    },
    guardian: getGuardianStatus(),
  });
}
