import { NextResponse } from "next/server";
import {
  listGithubBranches,
} from "@/lib/services/githubPublicArchive.service";
import {
  normalizeGithubRepoUrl,
  parseGithubOwnerRepoFromWebUrl,
} from "@/lib/gitHubCloneUrl";
import { getAppSettings } from "@/lib/settingsStore";
import { getConfig } from "@/lib/config";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { repo?: string } | null;
  const raw = body?.repo?.trim() ?? "";
  if (!raw) {
    return NextResponse.json({ error: "Provide a repo URL or owner/repo." }, { status: 400 });
  }

  const normalized = normalizeGithubRepoUrl(raw);
  const parsed = parseGithubOwnerRepoFromWebUrl(normalized);
  if (!parsed) {
    return NextResponse.json(
      { error: "Invalid github.com repository input." },
      { status: 400 }
    );
  }

  const token = getAppSettings().guardian.githubToken?.trim() || getConfig().githubToken;
  try {
    const data = await listGithubBranches({
      owner: parsed.owner,
      repo: parsed.repo,
      token: token || undefined,
      limit: 100,
    });
    return NextResponse.json({ ok: true, ...data });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 400 }
    );
  }
}

