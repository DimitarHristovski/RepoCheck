import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { logger } from "@/lib/logger";

const UA = "RepoCheck/1.0 (public GitHub archive scan)";

/** Optional cap when GitHub sends Content-Length (best-effort). */
const MAX_ZIP_BYTES = 120 * 1024 * 1024;

export async function fetchGithubDefaultBranch(
  owner: string,
  repo: string
): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": UA,
    },
    cache: "no-store",
  });

  if (res.status === 404) {
    throw new Error(
      "Repository not found. Use a public github.com repo name, or it may be private (not supported here)."
    );
  }
  if (res.status === 403) {
    const j = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(
      j.message?.includes("rate limit")
        ? "GitHub API rate limit exceeded. Try again in a few minutes."
        : "GitHub refused the request (403). Public repos only."
    );
  }
  if (!res.ok) {
    throw new Error(`GitHub API error (${res.status}).`);
  }

  const j = (await res.json()) as { default_branch?: string };
  return j.default_branch ?? "main";
}

/**
 * Download public repo as ZIP (no git), extract under analysisRoot, return path to repo root folder.
 */
export async function downloadPublicGithubRepoArchive(input: {
  owner: string;
  repo: string;
  branch: string;
  analysisRoot: string;
}): Promise<{ localPath: string }> {
  const { owner, repo, branch, analysisRoot } = input;
  const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${encodeURIComponent(branch)}.zip`;

  const res = await fetch(zipUrl, {
    headers: { "User-Agent": UA, Accept: "application/zip" },
    redirect: "follow",
    cache: "no-store",
  });

  if (res.status === 404) {
    throw new Error(
      `No ZIP for branch "${branch}". Pick another branch or check the repo is public.`
    );
  }
  if (!res.ok) {
    throw new Error(`GitHub download failed (${res.status}). Public github.com repos only.`);
  }

  const cl = res.headers.get("content-length");
  if (cl && Number(cl) > MAX_ZIP_BYTES) {
    throw new Error(
      `Archive is larger than ${Math.round(MAX_ZIP_BYTES / (1024 * 1024))} MB — skip or use a smaller checkout.`
    );
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_ZIP_BYTES) {
    throw new Error("Downloaded archive exceeds the size limit for scanning.");
  }

  fs.mkdirSync(input.analysisRoot, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(analysisRoot, "gh-archive-"));

  try {
    const zip = new AdmZip(buf);
    zip.extractAllTo(tmp, true);
  } catch (e) {
    logger.error({ err: e }, "zip extract failed");
    fs.rmSync(tmp, { recursive: true, force: true });
    throw new Error("Failed to extract GitHub archive.");
  }

  const entries = fs.readdirSync(tmp, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory());
  if (dirs.length !== 1) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw new Error("Unexpected GitHub ZIP layout.");
  }

  const localPath = path.join(tmp, dirs[0]!.name);
  return { localPath };
}
