import fs from "fs";
import path from "path";
import { getConfig } from "@/lib/config";
import type { FindingSeverity, HeuristicFinding } from "@/lib/types/findings";
import {
  fileMetadataHeuristics,
  pathSensitiveHeuristics,
  scanTextContent,
} from "@/lib/services/heuristicsEngine.service";

/** Skip walking into these directory names so the file budget covers handwritten project source. */
const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  "__pycache__",
  ".venv",
  "venv",
  ".turbo",
  ".nuxt",
  ".output",
  "out",
  "Pods",
  "target",
  ".cache",
  "vendor",
  "bower_components",
  ".gradle",
  "storybook-static",
  ".parcel-cache",
  ".vercel",
  ".netlify",
]);

const TEXT_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".yml",
  ".yaml",
  ".md",
  ".txt",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".gradle",
  ".rb",
  ".toml",
  ".sh",
  ".ps1",
  ".bat",
  ".php",
  ".vue",
  ".svelte",
  ".sql",
  ".xml",
  ".cs",
  ".fs",
  ".kt",
  ".kts",
  ".swift",
  ".scala",
  ".clj",
  ".graphql",
  ".ini",
  ".cfg",
  ".html",
  ".htm",
  ".properties",
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  "Dockerfile",
]);

function isProbablyTextFile(relPath: string): boolean {
  const base = path.basename(relPath);
  if (base === "Dockerfile" || base === "Makefile") return true;
  return TEXT_EXT.has(path.extname(relPath).toLowerCase());
}

function toPosixRel(rel: string): string {
  return rel.split(path.sep).join("/");
}

function scanPathPriority(rel: string): number {
  const n = toPosixRel(rel).toLowerCase();
  if (n === "package.json" || n.endsWith("/package.json")) return 0;
  if (n.includes(".github/workflows/")) return 1;
  if (n.startsWith("src/")) return 2;
  if (n.startsWith("lib/") || n.startsWith("apps/") || n.startsWith("packages/")) return 3;
  if (n.startsWith("scripts/") || n.startsWith("bin/")) return 4;
  return 10;
}

function sortRelPathsForScanDepth(relPaths: string[]): void {
  relPaths.sort(
    (a, b) => scanPathPriority(a) - scanPathPriority(b) || a.localeCompare(b)
  );
}

function walkRepo(
  root: string,
  maxFiles: number
): { relPaths: string[]; truncated: boolean; skippedDirEntries: number } {
  const relPaths: string[] = [];
  let count = 0;
  let truncated = false;
  let skippedDirEntries = 0;

  const walk = (dir: string) => {
    if (count >= maxFiles) {
      truncated = true;
      return;
    }
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (count >= maxFiles) {
        truncated = true;
        return;
      }
      if (SKIP_DIR_NAMES.has(ent.name)) {
        skippedDirEntries++;
        continue;
      }
      const abs = path.join(dir, ent.name);
      const rel = path.relative(root, abs);
      try {
        if (ent.isDirectory()) {
          walk(abs);
        } else if (ent.isFile()) {
          relPaths.push(rel);
          count++;
        }
      } catch {
        /* skip */
      }
    }
  };

  walk(root);
  sortRelPathsForScanDepth(relPaths);
  return { relPaths, truncated, skippedDirEntries };
}

function readUtf8FileCapped(abs: string, maxBytes: number): string | null {
  let st: fs.Stats;
  try {
    st = fs.statSync(abs);
  } catch {
    return null;
  }
  if (!st.isFile()) return null;
  if (st.size === 0) return "";
  const toRead = Math.min(st.size, maxBytes);
  const fd = fs.openSync(abs, "r");
  try {
    const buf = Buffer.alloc(toRead);
    fs.readSync(fd, buf, 0, toRead, 0);
    return buf.toString("utf8");
  } finally {
    fs.closeSync(fd);
  }
}

function countSeverity(findings: HeuristicFinding[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of findings) {
    out[f.severity] = (out[f.severity] ?? 0) + 1;
  }
  return out;
}

const SEV_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

function topFolderFromFilePath(fp: string): string {
  const norm = fp.replace(/\\/g, "/").replace(/^\//, "");
  const seg = norm.split("/").filter(Boolean);
  return seg[0] ?? "(root)";
}

export type HarmfulByFolderRow = {
  folder: string;
  count: number;
  worstSeverity: FindingSeverity;
};

function harmfulSignalsByTopFolder(
  findings: HeuristicFinding[],
  limit = 16
): HarmfulByFolderRow[] {
  const map = new Map<string, { count: number; worst: FindingSeverity }>();
  for (const f of findings) {
    if (!f.filePath?.trim()) continue;
    const folder = topFolderFromFilePath(f.filePath);
    const cur = map.get(folder) ?? { count: 0, worst: "info" as FindingSeverity };
    cur.count++;
    const wRank = SEV_RANK[cur.worst] ?? 9;
    const fRank = SEV_RANK[f.severity] ?? 9;
    if (fRank < wRank) cur.worst = f.severity as FindingSeverity;
    map.set(folder, cur);
  }
  return [...map.entries()]
    .sort(
      (a, b) =>
        b[1].count - a[1].count ||
        (SEV_RANK[a[1].worst] ?? 9) - (SEV_RANK[b[1].worst] ?? 9)
    )
    .slice(0, limit)
    .map(([folder, v]) => ({ folder, count: v.count, worstSeverity: v.worst }));
}

export function analyzeLocalRepo(repoRoot: string): {
  findings: HeuristicFinding[];
  treeSummary: {
    fileCount: number;
    truncated: boolean;
    topFolders: string[];
    skippedDependencyDirs: number;
    maxBytesPerTextFile: number;
  };
  severityCounts: Record<string, number>;
  harmfulByTopFolder: HarmfulByFolderRow[];
} {
  const cfg = getConfig();
  const findings: HeuristicFinding[] = [];
  const { relPaths, truncated, skippedDirEntries } = walkRepo(
    repoRoot,
    cfg.maxRepoWalkFiles
  );
  const folderCounts = new Map<string, number>();

  for (const rel of relPaths) {
    const top = toPosixRel(rel).split("/")[0] ?? rel;
    folderCounts.set(top, (folderCounts.get(top) ?? 0) + 1);
  }
  const topFolders = [...folderCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k]) => k);
  const suspiciousOnlyCategories = new Set([
    "shell_execution",
    "secret_harvest",
    "miner",
    "workflow_risk",
    "persistence",
    "obfuscation",
    "hidden_binary",
    "archive_anomaly",
    "type_mismatch",
  ]);
  const pushSuspicious = (items: HeuristicFinding[]) => {
    for (const item of items) {
      if (suspiciousOnlyCategories.has(item.category)) {
        findings.push(item);
      }
    }
  };

  for (const rel of relPaths) {
    const abs = path.join(repoRoot, rel);
    const top = rel.split(path.sep)[0] ?? rel;
    let st: fs.Stats | null = null;
    try {
      st = fs.lstatSync(abs);
    } catch {
      st = null;
    }

    if (st) {
      pushSuspicious(
        fileMetadataHeuristics({
          relativePath: rel,
          extension: path.extname(rel),
          sizeBytes: st.size,
          isHidden: path.basename(rel).startsWith("."),
          isSymlink: st.isSymbolicLink(),
          category: top,
          cfg: {
            dangerousExtensions: [".exe", ".scr", ".bat", ".cmd", ".ps1", ".vbs", ".jar", ".sh"],
            doubleExtensionHints: [".pdf.exe", ".docx.exe", ".png.js", ".txt.bat"],
          },
        })
      );
    }

    // Path-only checks are still useful for obvious suspicious artifacts.
    pushSuspicious(pathSensitiveHeuristics(rel));

    if (!isProbablyTextFile(rel)) continue;
    const raw = readUtf8FileCapped(abs, cfg.maxScanFileBytes);
    if (raw === null) continue;
    pushSuspicious(
      scanTextContent(rel, raw, path.extname(rel), {
        dangerousExtensions: [],
        doubleExtensionHints: [".pdf.exe", ".docx.exe", ".png.js", ".txt.bat"],
      })
    );
  }

  const severityCounts = countSeverity(findings);
  const harmfulByTopFolder = harmfulSignalsByTopFolder(findings);

  return {
    findings,
    treeSummary: {
      fileCount: relPaths.length,
      truncated,
      topFolders,
      skippedDependencyDirs: skippedDirEntries,
      maxBytesPerTextFile: cfg.maxScanFileBytes,
    },
    severityCounts,
    harmfulByTopFolder,
  };
}
