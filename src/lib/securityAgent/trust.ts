import type { FileTrustLevel } from "./types";

const N = (p: string) => p.replace(/\\/g, "/").toLowerCase();

/**
 * Classify path per §1 — deterministic, path-only (no content).
 */
export function inferFileTrustLevel(filePath: string): {
  level: FileTrustLevel;
  rationale: string;
} {
  const p = N(filePath);

  if (
    p.includes("/.next/") ||
    p.endsWith("/.next") ||
    p.includes("/dist/") ||
    p.includes("/build/") ||
    p.includes("vendor-chunks") ||
    /\.min\.(js|mjs|cjs)$/i.test(p)
  ) {
    return {
      level: "LOW_PRIORITY",
      rationale:
        "Generated or bundled output (.next, dist, build, vendor chunks, minified) — weak primary evidence.",
    };
  }

  if (p.endsWith("package.json")) {
    return {
      level: "HIGH_PRIORITY",
      rationale: "package.json controls install lifecycle and dependencies.",
    };
  }

  if (
    /\.(config|rc)(\.[a-z0-9]+)?$/i.test(p) ||
    /(^|\/)tailwind\.config\./i.test(p) ||
    /(^|\/)vite\.config\./i.test(p) ||
    /(^|\/)next\.config\./i.test(p) ||
    /(^|\/)webpack\.config\./i.test(p)
  ) {
    return {
      level: "HIGH_PRIORITY",
      rationale: "Tooling/config file — changes here affect build and runtime.",
    };
  }

  if (p.includes(".github/workflows/") && /\.ya?ml$/i.test(p)) {
    return {
      level: "HIGH_PRIORITY",
      rationale: "CI workflow — can access secrets and run arbitrary steps.",
    };
  }

  if (p.includes("/scripts/") || p.startsWith("scripts/")) {
    return {
      level: "HIGH_PRIORITY",
      rationale: "scripts/ often runs in install/CI contexts.",
    };
  }

  if (
    p.includes("/app/api/") ||
    p.includes("/pages/api/") ||
    /(^|\/)server\.(ts|js)$/i.test(p) ||
    /(^|\/)api\/route\.(ts|js|tsx|jsx)$/i.test(p)
  ) {
    return {
      level: "HIGH_PRIORITY",
      rationale: "Server or API surface — network and secret handling expected; still high impact.",
    };
  }

  if (
    p.startsWith("src/") ||
    p.includes("/src/") ||
    p.startsWith("lib/") ||
    p.includes("/lib/") ||
    p.includes("/components/")
  ) {
    return {
      level: "MEDIUM_PRIORITY",
      rationale: "Application source — first-party logic; context matters.",
    };
  }

  return {
    level: "UNKNOWN",
    rationale: "Path does not match a standard high/medium/low bucket.",
  };
}

export function isLowPriorityOnlyPath(filePath: string): boolean {
  return inferFileTrustLevel(filePath).level === "LOW_PRIORITY";
}
