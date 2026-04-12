import fs from "fs";
import path from "path";
import { getConfig } from "@/lib/config";
import type { HeuristicFinding } from "@/lib/types/findings";
import {
  parseDockerfile,
  parseMakefile,
  parsePackageJson,
  parseRequirementsTxt,
} from "@/lib/services/manifestParser.service";
import {
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

  for (const rel of relPaths) {
    findings.push(...pathSensitiveHeuristics(rel));
    const abs = path.join(repoRoot, rel);
    const lower = rel.toLowerCase().replace(/\\/g, "/");

    if (lower.endsWith("package.json")) {
      findings.push(...parsePackageJson(abs, rel));
    }
    if (lower.endsWith("requirements.txt")) {
      findings.push(...parseRequirementsTxt(abs, rel));
    }
    if (path.basename(rel).toLowerCase() === "dockerfile") {
      findings.push(...parseDockerfile(abs, rel));
    }
    if (path.basename(rel).toLowerCase() === "makefile") {
      findings.push(...parseMakefile(abs, rel));
    }

    if (!isProbablyTextFile(rel)) continue;
    let raw: string;
    try {
      raw = fs.readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    findings.push(
      ...scanTextContent(rel, raw, path.extname(rel), {
        dangerousExtensions: [],
        doubleExtensionHints: [".pdf.exe", ".docx.exe", ".png.js", ".txt.bat"],
      })
    );
  }

  const readme = relPaths.some(
    (r) => /^readme\.md$/i.test(path.basename(r)) || /^readme$/i.test(r)
  );
  if (!readme) {
    findings.push({
      severity: "info",
      category: "default",
      title: "No README found",
      description:
        "Missing README is weak trust signal only; many benign snippets omit it.",
      evidence: {},
    });
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
