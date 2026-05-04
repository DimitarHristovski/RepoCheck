import { NextResponse } from "next/server";
import { settingsPatchSchema } from "@/lib/validations/api";
import { getAppSettings, setAppSettings } from "@/lib/settingsStore";
import { writeAuditLog } from "@/lib/services/auditLog.service";
import { getConfig, resolveOpenAiApiKey } from "@/lib/config";
import {
  getGuardianStatus,
  restartGuardianService,
  runGuardianNow,
  startGuardianService,
} from "@/lib/services/guardian.service";
import { listGithubAccountRepos } from "@/lib/services/githubPublicArchive.service";

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
  let payload = parsed.data;
  let autoImportedRepoCount = 0;

  const incomingToken = payload.guardian?.githubToken?.trim();
  const effectiveToken =
    incomingToken || getAppSettings().guardian.githubToken?.trim() || getConfig().githubToken;

  if (!effectiveToken?.trim()) {
    payload = {
      ...payload,
      guardian: {
        ...(payload.guardian ?? {}),
        githubAccountLogin: "",
      },
    };
  }

  if (effectiveToken) {
    try {
      const gh = await listGithubAccountRepos({ token: effectiveToken, maxPages: 10 });
      const githubRepos = gh.repos.map((x) => x.fullName);
      autoImportedRepoCount = githubRepos.length;
      payload = {
        ...payload,
        guardian: {
          ...(payload.guardian ?? {}),
          enabled: true,
          githubRepos,
          githubAccountLogin: gh.login,
        },
      };
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : String(e) },
        { status: 400 }
      );
    }
  }

  const next = setAppSettings(payload);
  restartGuardianService();
  void runGuardianNow();
  writeAuditLog({ actor: "user", action: "settings_update" });
  const cfg = getConfig();
  return NextResponse.json({
    settings: next,
    autoImportedRepoCount,
    runtime: {
      effectiveModelProvider: cfg.REPOCHECK_MODEL_PROVIDER,
      hasOpenAiKey: Boolean(resolveOpenAiApiKey()),
      hasOpenAiBaseUrl: Boolean(process.env.OPENAI_BASE_URL),
    },
    guardian: getGuardianStatus(),
  });
}
