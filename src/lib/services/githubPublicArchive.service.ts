import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { logger } from "@/lib/logger";

const UA = "RepoCheck/1.0 (public GitHub archive scan)";

/** Optional cap when GitHub sends Content-Length (best-effort). */
const MAX_ZIP_BYTES = 120 * 1024 * 1024;

function githubHeaders(token?: string): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": UA,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchGithubDefaultBranch(
  owner: string,
  repo: string,
  token?: string
): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: githubHeaders(token),
    cache: "no-store",
  });

  if (res.status === 404) {
    throw new Error(
      token
        ? "Repository not found or token has no access."
        : "Repository not found. It may be private; add a GitHub token in Settings."
    );
  }
  if (res.status === 403) {
    const j = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(
      j.message?.includes("rate limit")
        ? "GitHub API rate limit exceeded. Try again in a few minutes."
        : token
          ? "GitHub refused access (403). Check token scopes/repo access."
          : "GitHub refused the request (403). Private repos require a token in Settings."
    );
  }
  if (!res.ok) {
    throw new Error(`GitHub API error (${res.status}).`);
  }

  const j = (await res.json()) as { default_branch?: string };
  return j.default_branch ?? "main";
}

export async function listGithubBranches(input: {
  owner: string;
  repo: string;
  token?: string;
  limit?: number;
}): Promise<{ branches: string[]; defaultBranch: string }> {
  const { owner, repo, token } = input;
  const perPage = Math.min(100, Math.max(1, input.limit ?? 100));
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/branches?per_page=${perPage}`,
    {
      headers: githubHeaders(token),
      cache: "no-store",
    }
  );
  if (res.status === 404) {
    throw new Error(
      token
        ? "Repository not found or token has no access."
        : "Repository not found. It may be private; add a GitHub token in Settings."
    );
  }
  if (res.status === 401) {
    throw new Error("GitHub token invalid or expired. Update token in Settings.");
  }
  if (res.status === 403) {
    const j = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(
      j.message?.includes("rate limit")
        ? "GitHub API rate limit exceeded. Try again in a few minutes."
        : token
          ? "GitHub refused access (403). Check token scopes/repo access."
          : "GitHub refused the request (403). Private repos require a token in Settings."
    );
  }
  if (!res.ok) {
    throw new Error(`GitHub branches API error (${res.status}).`);
  }
  const rows = (await res.json()) as Array<{ name?: string }>;
  const branches = rows
    .map((x) => x.name?.trim() ?? "")
    .filter(Boolean);
  const defaultBranch = await fetchGithubDefaultBranch(owner, repo, token);
  return { branches, defaultBranch };
}

/**
 * Download repo as ZIP (no git), extract under analysisRoot, return path to repo root folder.
 * Uses GitHub API zipball endpoint so private repos work with token auth.
 */
export async function downloadGithubRepoArchive(input: {
  owner: string;
  repo: string;
  branch: string;
  analysisRoot: string;
  token?: string;
}): Promise<{ localPath: string }> {
  const { owner, repo, branch, analysisRoot, token } = input;
  const zipUrl = `https://api.github.com/repos/${owner}/${repo}/zipball/${encodeURIComponent(branch)}`;

  const res = await fetch(zipUrl, {
    headers: {
      ...githubHeaders(token),
      Accept: "application/vnd.github+json",
    },
    redirect: "follow",
    cache: "no-store",
  });

  if (res.status === 404) {
    throw new Error(
      token
        ? `No archive for branch "${branch}" or no token access.`
        : `No archive for branch "${branch}". If repo is private, add a token in Settings.`
    );
  }
  if (res.status === 401) {
    throw new Error("GitHub token invalid or expired. Update token in Settings.");
  }
  if (!res.ok) {
    throw new Error(`GitHub download failed (${res.status}). Check repo visibility and token access.`);
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
