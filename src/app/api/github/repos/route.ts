import { NextResponse } from "next/server";
import { listGithubAccountRepos } from "@/lib/services/githubPublicArchive.service";
import { getAppSettings } from "@/lib/settingsStore";
import { getConfig } from "@/lib/config";

export const runtime = "nodejs";

export async function POST() {
  const token = getAppSettings().guardian.githubToken?.trim() || getConfig().githubToken;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Set a GitHub token in Settings first." },
      { status: 400 }
    );
  }

  try {
    const data = await listGithubAccountRepos({ token, maxPages: 10 });
    return NextResponse.json({
      ok: true,
      login: data.login,
      repos: data.repos,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 400 }
    );
  }
}
