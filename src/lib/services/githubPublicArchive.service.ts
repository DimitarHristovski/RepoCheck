import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { logger } from "@/lib/logger";

const UA = "RepoCheck/1.0 (public GitHub archive scan)";


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

export async function listGithubAccountRepos(input: {
  token: string;
  maxPages?: number;
}): Promise<{ login: string; repos: Array<{ fullName: string; isPrivate: boolean }> }> {
  const token = input.token.trim();
  if (!token) {
    throw new Error("GitHub token is required.");
  }

  const me = await fetch("https://api.github.com/user", {
    headers: githubHeaders(token),
    cache: "no-store",
  });
  if (me.status === 401) {
    throw new Error("GitHub token invalid or expired. Update token in Settings.");
  }
  if (!me.ok) {
    throw new Error(`GitHub account lookup failed (${me.status}).`);
  }
  const meJson = (await me.json()) as { login?: string };
  const login = (meJson.login ?? "").trim();
  if (!login) {
    throw new Error("Unable to read GitHub account profile from token.");
  }

  const repos: Array<{ fullName: string; isPrivate: boolean }> = [];
  const maxPages = Math.max(1, Math.min(10, input.maxPages ?? 10));

  for (let page = 1; page <= maxPages; page += 1) {
    const res = await fetch(
      `https://api.github.com/user/repos?per_page=100&page=${page}&sort=updated&direction=desc&affiliation=owner,collaborator,organization_member`,
      {
        headers: githubHeaders(token),
        cache: "no-store",
      }
    );

    if (res.status === 401) {
      throw new Error("GitHub token invalid or expired. Update token in Settings.");
    }
    if (res.status === 403) {
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(
        j.message?.includes("rate limit")
          ? "GitHub API rate limit exceeded. Try again in a few minutes."
          : "GitHub refused repo listing (403). Check token scopes/repo access."
      );
    }
    if (!res.ok) {
      throw new Error(`GitHub repo listing failed (${res.status}).`);
    }

    const rows = (await res.json()) as Array<{ full_name?: string; private?: boolean }>;
    if (rows.length === 0) break;
    for (const row of rows) {
      const fullName = row.full_name?.trim() ?? "";
      if (!fullName) continue;
      repos.push({ fullName, isPrivate: Boolean(row.private) });
    }
    if (rows.length < 100) break;
  }

  return { login, repos };
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

  const buf = Buffer.from(await res.arrayBuffer());

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
