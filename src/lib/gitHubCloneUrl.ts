/**
 * Normalize user input into a canonical GitHub web URL (for parsing owner/repo).
 * Optimized for GitHub (shorthand, SSH, /tree/ links). Non-GitHub URLs are returned as-is.
 */

/** GitHub owner/repo shorthand (no URL scheme). */
const OWNER_REPO = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
const SSH_GITHUB =
  /^git@github\.com:([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?$/i;

export function normalizeGithubRepoUrl(input: string): string {
  const raw = input.trim();
  if (!raw) return raw;

  const ssh = raw.match(SSH_GITHUB);
  if (ssh) {
    return `https://github.com/${ssh[1]}/${ssh[2]}.git`;
  }

  if (OWNER_REPO.test(raw) && !raw.includes("://") && !raw.includes("@")) {
    return `https://github.com/${raw}.git`;
  }

  let u = raw;
  if (!/^https?:\/\//i.test(u)) {
    u = `https://${u}`;
  }

  try {
    const parsed = new URL(u);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "github.com") {
      return parsed.toString();
    }

    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length < 2) {
      return `https://github.com${parsed.pathname}`.replace(/\/+$/, "");
    }

    const owner = parts[0]!;
    let repo = parts[1]!;
    repo = repo.replace(/\.git$/i, "");
    const base = `https://github.com/${owner}/${repo}.git`;
    if (parsed.username) {
      const u2 = new URL(base);
      u2.username = parsed.username;
      u2.password = parsed.password;
      return u2.toString();
    }
    return base;
  } catch {
    return raw;
  }
}

export function isValidCloneHttpUrl(href: string): boolean {
  try {
    const u = new URL(href);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Owner/repo for public GitHub archive download — github.com only, no credentials.
 */
export function parseGithubOwnerRepoFromWebUrl(
  href: string
): { owner: string; repo: string } | null {
  try {
    const u = new URL(href);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "github.com") return null;
    if (u.username || u.password) return null;

    let pathname = u.pathname.replace(/\/+$/, "");
    pathname = pathname.replace(/\.git$/i, "");
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const owner = parts[0]!;
    const repo = parts[1]!.replace(/\.git$/i, "");
    if (!owner || !repo) return null;
    return { owner, repo };
  } catch {
    return null;
  }
}
