import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { getAppSettings } from "@/lib/settingsStore";
import {
  getGuardianStatus,
  startGuardianService,
} from "@/lib/services/guardian.service";

export const runtime = "nodejs";

export function GET() {
  startGuardianService();
  const cfg = getConfig();
  const settings = getAppSettings().guardian;
  const status = getGuardianStatus();
  return NextResponse.json({
    ok: true,
    envGuardian: {
      enabled: cfg.guardianEnabled,
      pollMs: cfg.guardianPollMs,
      alertMinSeverity: cfg.guardianAlertMinSeverity,
      githubRepos: cfg.guardianGithubRepos,
      localWatchDirs: cfg.guardianLocalWatchDirs,
    },
    appGuardian: {
      ...settings,
      githubToken: settings.githubToken ? "***configured***" : "",
    },
    ...status,
  });
}

