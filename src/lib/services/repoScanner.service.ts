import fs from "fs";
import path from "path";
import { getConfig } from "@/lib/config";
import type { HeuristicFinding } from "@/lib/types/findings";
import {
  fileMetadataHeuristics,
  pathSensitiveHeuristics,
  scanTextContent,
} from "@/lib/services/heuristicsEngine.service";

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
  "Dockerfile",
]);

function isProbablyTextFile(relPath: string): boolean {
  const base = path.basename(relPath);
  if (base === "Dockerfile" || base === "Makefile") return true;
  return TEXT_EXT.has(path.extname(relPath).toLowerCase());
}

function walkRepo(
  root: string,
  maxFiles: number
): { relPaths: string[]; truncated: boolean } {
  const relPaths: string[] = [];
  let count = 0;
  let truncated = false;

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
      const abs = path.join(dir, ent.name);
      const rel = path.relative(root, abs);
      if (
        rel.startsWith("node_modules") ||
        rel.startsWith(".git" + path.sep) ||
        rel === ".git"
      ) {
        continue;
      }
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
  return { relPaths, truncated };
}

export function analyzeLocalRepo(repoRoot: string): {
  findings: HeuristicFinding[];
  treeSummary: { fileCount: number; truncated: boolean; topFolders: string[] };
} {
  const cfg = getConfig();
  const findings: HeuristicFinding[] = [];
  const { relPaths, truncated } = walkRepo(repoRoot, cfg.maxRepoWalkFiles);
  const folderCounts = new Map<string, number>();

  for (const rel of relPaths) {
    const top = rel.split(path.sep)[0] ?? rel;
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
    let raw: string;
    try {
      raw = fs.readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    pushSuspicious(
      scanTextContent(rel, raw, path.extname(rel), {
        dangerousExtensions: [],
        doubleExtensionHints: [".pdf.exe", ".docx.exe", ".png.js", ".txt.bat"],
      })
    );
  }

  return {
    findings,
    treeSummary: {
      fileCount: relPaths.length,
      truncated,
      topFolders,
    },
  };
}
