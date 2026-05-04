/** Path-based trust tier for auditor STEP 1 (heuristic). Client-safe — no Node/store imports. */
export function inferPathTrustTier(filePath: string | null): string {
  if (!filePath) return "UNKNOWN";
  const p = filePath.replace(/\\/g, "/").toLowerCase();

  if (
    p.includes("/.next/") ||
    p.endsWith("/.next") ||
    p.includes("/dist/") ||
    p.includes("/build/") ||
    p.includes("vendor-chunks") ||
    /\.min\.(js|mjs|cjs)$/i.test(p)
  ) {
    return "LOW_TRUST_GENERATED";
  }

  if (
    p.endsWith("package.json") ||
    /tailwind\.config\./i.test(p) ||
    /vite\.config\./i.test(p) ||
    /next\.config\./i.test(p) ||
    p.includes(".github/workflows/") ||
    p.includes("/scripts/") ||
    p.includes("server/api/") ||
    (p.includes("/api/") && (p.includes("/route.") || p.includes("/routes/")))
  ) {
    return "HIGH_TRUST_CONFIG_OR_CI";
  }

  if (
    p.startsWith("src/") ||
    p.includes("/src/") ||
    p.includes("/app/") ||
    p.includes("/pages/") ||
    p.includes("/lib/") ||
    p.includes("/components/")
  ) {
    return "MEDIUM_TRUST_APP";
  }

  return "UNCLASSIFIED";
}
