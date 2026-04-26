import fs from "fs";
import path from "path";
import os from "os";
import AdmZip from "adm-zip";
import type { HeuristicFinding } from "@/lib/types/findings";
import {
  pathSensitiveHeuristics,
  scanTextContent,
} from "@/lib/services/heuristicsEngine.service";
import { logger } from "@/lib/logger";

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
  ".toml",
  ".sh",
  ".ps1",
  ".bat",
]);

const MAX_FILES_PER_UPLOAD = 220;
const MAX_ZIP_ENTRIES = 400;
const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  "__pycache__",
  ".venv",
  "venv",
]);

function isProbablyTextFile(relPath: string): boolean {
  const base = path.basename(relPath);
  if (base === "Dockerfile" || base === "Makefile") return true;
  return TEXT_EXT.has(path.extname(relPath).toLowerCase());
}

function scanTextBuffer(relPath: string, buf: Buffer): HeuristicFinding[] {
  const ext = path.extname(relPath);
  const findings: HeuristicFinding[] = [...pathSensitiveHeuristics(relPath)];
  if (!isProbablyTextFile(relPath)) return findings;
  try {
    const text = buf.toString("utf8");
    findings.push(...scanTextContent(relPath, text, ext));
  } catch {
    /* skip binary */
  }
  return findings;
}

function walkDirFindings(rootDir: string, virtualPrefix: string): HeuristicFinding[] {
  const out: HeuristicFinding[] = [];
  let count = 0;

  const walk = (absDir: string, relBase: string) => {
    if (count >= MAX_FILES_PER_UPLOAD) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (count >= MAX_FILES_PER_UPLOAD) return;
      const rel = relBase ? `${relBase}/${ent.name}` : ent.name;
      const abs = path.join(absDir, ent.name);
      if (ent.isDirectory()) {
        if (SKIP_DIR_NAMES.has(ent.name)) continue;
        walk(abs, rel);
        continue;
      }
      if (!ent.isFile()) continue;
      count++;
      const vpath = `${virtualPrefix}/${rel}`.replace(/\/+/g, "/");
      out.push(...pathSensitiveHeuristics(vpath));
      if (!isProbablyTextFile(rel)) continue;
      let buf: Buffer;
      try {
        buf = fs.readFileSync(abs);
      } catch {
        continue;
      }
      out.push(...scanTextBuffer(vpath, buf));
    }
  };

  walk(rootDir, "");
  return out;
}

/**
 * Extract ZIP to temp dir with basic zip-slip protection; scan text files with heuristics.
 */
export function analyzeZipBuffer(
  buffer: Buffer,
  displayName: string
): { findings: HeuristicFinding[]; contextBlock: string } {
  const findings: HeuristicFinding[] = [];
  const zip = new AdmZip(buffer);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "repocheck-z-"));
  const rootResolved = path.resolve(tmp);

  try {
    let entries = 0;
    for (const entry of zip.getEntries()) {
      if (entries >= MAX_ZIP_ENTRIES) break;
      if (entry.isDirectory) continue;
      const rawName = entry.entryName.replace(/^\/+/, "").replace(/\\/g, "/");
      if (!rawName || rawName.includes("..")) continue;
      const dest = path.resolve(tmp, rawName);
      if (!dest.startsWith(rootResolved + path.sep) && dest !== rootResolved) {
        logger.warn({ rawName }, "zip-slip blocked");
        continue;
      }
      entries++;
      try {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, entry.getData());
      } catch (e) {
        logger.warn({ err: e, rawName }, "zip entry write failed");
      }
    }

    const walked = walkDirFindings(tmp, `upload:${displayName}`);
    findings.push(...walked);
  } finally {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  return {
    findings,
    contextBlock: formatFindingsForChatContext(findings, `ZIP: ${displayName}`),
  };
}

export function analyzeSingleTextLikeFile(
  buffer: Buffer,
  displayName: string
): { findings: HeuristicFinding[]; contextBlock: string } {
  const safeName = displayName.replace(/[/\\]/g, "_");
  const vpath = `upload:${safeName}`;
  const findings = scanTextBuffer(vpath, buffer);
  return {
    findings,
    contextBlock: formatFindingsForChatContext(findings, `File: ${safeName}`),
  };
}

export function formatFindingsForChatContext(
  findings: HeuristicFinding[],
  sourceLabel: string
): string {
  if (!findings.length) {
    return `Source: ${sourceLabel}\n(No medium-relevant heuristic signals; archive may be empty or binary-only.)`;
  }
  const lines = findings.slice(0, 80).map((f, i) => {
    const p = f.filePath ?? "(path unknown)";
    const d = (f.description ?? "").slice(0, 320);
    return `${i + 1}. [${f.severity}] ${f.category} — ${f.title}\n   Path: ${p}\n   Note: ${d}`;
  });
  return `Source: ${sourceLabel}\n\n${lines.join("\n\n")}`;
}

export function mergeUploadContexts(blocks: string[]): string {
  return blocks.filter(Boolean).join("\n\n---\n\n");
}
