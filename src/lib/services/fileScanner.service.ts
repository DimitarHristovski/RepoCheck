import fs from "fs";
import path from "path";
import crypto from "crypto";
import { assertPathUnderApprovedRoots } from "@/lib/security/pathGuard";
import type { FileCategory } from "@/lib/types/findings";
import {
  fileMetadataHeuristics,
  scanTextContent,
} from "@/lib/services/heuristicsEngine.service";
import type { HeuristicFinding } from "@/lib/types/findings";
import { getScanMaxFileBytes } from "@/lib/scanLimits";

export type InventoryItem = {
  relativePath: string;
  absolutePath: string;
  extension: string;
  sizeBytes: number;
  sha256: string | null;
  category: FileCategory;
  createdAtFs: Date | null;
  modifiedAtFs: Date | null;
  flags: string[];
  suspicious: HeuristicFinding[];
};

const IMAGE_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".ico",
  ".bmp",
]);
const DOC_EXT = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".txt",
  ".md",
  ".rtf",
  ".odt",
]);
const ARCHIVE_EXT = new Set([
  ".zip",
  ".tar",
  ".gz",
  ".tgz",
  ".rar",
  ".7z",
]);
const CODE_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".cs",
  ".cpp",
  ".c",
  ".h",
]);
const SCRIPT_EXT = new Set([".sh", ".ps1", ".bat", ".cmd"]);
const INSTALLER_EXT = new Set([
  ".exe",
  ".msi",
  ".dmg",
  ".pkg",
  ".deb",
  ".rpm",
]);

function categorize(ext: string, base: string): FileCategory {
  const e = ext.toLowerCase();
  if (IMAGE_EXT.has(e)) return "images";
  if (DOC_EXT.has(e)) return "documents";
  if (ARCHIVE_EXT.has(e)) return "archives";
  if (INSTALLER_EXT.has(e)) return "installers";
  if (SCRIPT_EXT.has(e)) return "scripts";
  if (CODE_EXT.has(e)) return "code";
  if (base.startsWith(".")) return "unknown";
  return "unknown";
}

function isBinaryBuffer(buf: Buffer): boolean {
  const sample = buf.subarray(0, Math.min(buf.length, 8000));
  let suspicious = 0;
  for (let i = 0; i < sample.length; i++) {
    const c = sample[i];
    if (c === 0) return true;
    if (c < 9 || (c > 13 && c < 32)) suspicious++;
  }
  return suspicious / sample.length > 0.3;
}

export function scanApprovedFolder(input: {
  rootPath: string;
  approvedRoots: string[];
  maxDepth?: number;
  ignorePatterns?: string[];
}): { items: InventoryItem[]; findings: HeuristicFinding[]; errors: string[] } {
  const maxDepth = input.maxDepth ?? 32;
  const root = assertPathUnderApprovedRoots(input.rootPath, input.approvedRoots);
  const items: InventoryItem[] = [];
  const findings: HeuristicFinding[] = [];
  const errors: string[] = [];
  const maxBytes = getScanMaxFileBytes();
  const hashMap = new Map<string, string[]>();

  const shouldIgnore = (rel: string) => {
    const p = rel.replace(/\\/g, "/");
    for (const pat of input.ignorePatterns ?? []) {
      if (!pat) continue;
      if (p.includes(pat) || p.startsWith(pat)) return true;
    }
    return (
      p.includes("/node_modules/") ||
      p.includes("/.git/") ||
      p.endsWith("/.git")
    );
  };

  const walk = (dir: string, depth: number) => {
    if (depth > maxDepth) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      errors.push(`${dir}: ${String(e)}`);
      return;
    }
    for (const ent of entries) {
      const abs = path.join(dir, ent.name);
      const rel = path.relative(root, abs);
      if (shouldIgnore(rel)) continue;
      try {
        if (ent.isSymbolicLink()) {
          const st = fs.lstatSync(abs);
          const category = categorize(path.extname(ent.name), ent.name);
          const inv: InventoryItem = {
            relativePath: rel,
            absolutePath: abs,
            extension: path.extname(ent.name),
            sizeBytes: st.size,
            sha256: null,
            category,
            createdAtFs: st.birthtime ?? null,
            modifiedAtFs: st.mtime ?? null,
            flags: ["symlink"],
            suspicious: fileMetadataHeuristics({
              relativePath: rel,
              extension: path.extname(ent.name),
              sizeBytes: st.size,
              isHidden: ent.name.startsWith("."),
              isSymlink: true,
              category,
            }),
          };
          items.push(inv);
          findings.push(...inv.suspicious);
          continue;
        }
        if (ent.isDirectory()) {
          walk(abs, depth + 1);
          continue;
        }
        if (!ent.isFile()) continue;

        const st = fs.statSync(abs);
        const ext = path.extname(ent.name);
        const category = categorize(ext, ent.name);
        let sha256: string | null = null;
        const flags: string[] = [];

        if (st.size <= maxBytes) {
          let buf: Buffer;
          try {
            buf = fs.readFileSync(abs);
          } catch (e) {
            errors.push(`${abs}: ${String(e)}`);
            buf = Buffer.alloc(0);
          }
          if (buf.length > 0) {
            sha256 = crypto.createHash("sha256").update(buf).digest("hex");
            const dupList = hashMap.get(sha256) ?? [];
            dupList.push(rel);
            hashMap.set(sha256, dupList);
            if (!isBinaryBuffer(buf)) {
              const text = buf.toString("utf8");
              findings.push(
                ...scanTextContent(rel, text, ext, {
                  dangerousExtensions: [],
                  doubleExtensionHints: [
                    ".pdf.exe",
                    ".docx.exe",
                    ".png.js",
                    ".txt.bat",
                  ],
                })
              );
            } else {
              flags.push("binary_skipped_content_scan");
            }
          }
        } else {
          flags.push("skipped_large_file");
        }

        const metaFindings = fileMetadataHeuristics({
          relativePath: rel,
          extension: ext,
          sizeBytes: st.size,
          isHidden: ent.name.startsWith("."),
          isSymlink: false,
          category,
        });

        const inv: InventoryItem = {
          relativePath: rel,
          absolutePath: abs,
          extension: ext,
          sizeBytes: st.size,
          sha256,
          category,
          createdAtFs: st.birthtime ?? null,
          modifiedAtFs: st.mtime ?? null,
          flags,
          suspicious: metaFindings,
        };
        items.push(inv);
        findings.push(...metaFindings);
      } catch (e) {
        errors.push(`${abs}: ${String(e)}`);
      }
    }
  };

  walk(root, 0);

  for (const [, paths] of hashMap) {
    if (paths.length > 1) {
      findings.push({
        severity: "low",
        category: "duplicate_system_name",
        title: "Duplicate content (hash match)",
        description: `Same SHA-256 across ${paths.length} files; candidates for deduplication review.`,
        evidence: { paths: paths.slice(0, 20) },
      });
    }
  }

  return { items, findings, errors };
}
