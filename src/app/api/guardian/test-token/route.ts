import { NextResponse } from "next/server";
import { getAppSettings } from "@/lib/settingsStore";
import { getConfig } from "@/lib/config";

export const runtime = "nodejs";

export async function POST() {
  const token = getAppSettings().guardian.githubToken?.trim() || getConfig().githubToken;
  if (!token) {
    return NextResponse.json(
      { ok: false, message: "No GitHub token configured in Settings or env." },
      { status: 400 }
    );
  }

  const res = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "RepoCheck/1.0 token-test",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json(
      {
        ok: false,
        message:
          res.status === 401
            ? "Token is invalid or expired."
            : `Token check failed (${res.status}).`,
      },
      { status: 400 }
    );
  }

  const data = (await res.json()) as { login?: string };
  return NextResponse.json({
    ok: true,
    message: `Token valid for ${data.login ?? "GitHub user"}.`,
  });
}

