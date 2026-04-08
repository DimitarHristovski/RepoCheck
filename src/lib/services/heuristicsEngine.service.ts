import type { HeuristicFinding } from "@/lib/types/findings";
import path from "path";

const SHELL_PIPE_PATTERNS = [
  /\bcurl\b[^|\n]*\|\s*(?:bash|sh|zsh|fish)\b/i,
  /\bwget\b[^|\n]*\|\s*(?:bash|sh)\b/i,
  /\bchmod\s+\+x\b.*\b(?:curl|wget)\b/i,
];

const JS_RISK = [
  { re: /\beval\s*\(/, tag: "eval" },
  { re: /\bnew\s+Function\s*\(/, tag: "Function_ctor" },
  { re: /child_process|require\s*\(\s*['"]child_process['"]\s*\)/, tag: "child_process" },
  { re: /\bexec(?:Sync)?\s*\(|\bspawn(?:Sync)?\s*\(/, tag: "exec_spawn" },
  { re: /crypto\.getRandomValues|miner|stratum\+tcp/i, tag: "miner_hint" },
  { re: /navigator\.clipboard|document\.cookie\b/i, tag: "browser_token_access" },
];

const PY_RISK = [
  { re: /\bos\.system\s*\(|\bsubprocess\.(?:call|Popen|run)\s*\(/, tag: "subprocess" },
  { re: /base64\.b64decode|marshal\.loads|pickle\.loads/i, tag: "decode_exec" },
  { re: /\brequests\.(?:get|post)\s*\([^)]*http/i, tag: "http_request" },
];

const WORKFLOW_EXFIL = [
  /secrets?\s*:\s*\[\s*['"][^'"]+['"]\s*\]/i,
  /curl\s+.*github\.com\/repos\/.*\/contents/i,
];

export type HeuristicConfig = {
  dangerousExtensions: string[];
  doubleExtensionHints: string[];
};

const DEFAULT_CONFIG: HeuristicConfig = {
  dangerousExtensions: [
    ".exe",
    ".scr",
    ".bat",
    ".cmd",
    ".ps1",
    ".vbs",
    ".js",
    ".jar",
    ".dmg",
    ".pkg",
    ".msi",
    ".deb",
    ".sh",
  ],
  doubleExtensionHints: [".pdf.exe", ".docx.exe", ".png.js", ".txt.bat"],
};

export function scanTextContent(
  relPath: string,
  content: string,
  ext: string,
  cfg: HeuristicConfig = DEFAULT_CONFIG
): HeuristicFinding[] {
  const out: HeuristicFinding[] = [];
  const lower = relPath.toLowerCase();

  for (const p of SHELL_PIPE_PATTERNS) {
    if (p.test(content)) {
      out.push({
        severity: "high",
        category: "shell_execution",
        title: "Possible pipe-to-shell pattern",
        description:
          "Content appears to fetch remote data and pipe it into a shell interpreter, which can execute arbitrary code.",
        evidence: { pattern: p.source, path: relPath },
        filePath: relPath,
      });
    }
  }

  if (/\.(m?js|ts|jsx|tsx|cjs)$/.test(ext) || lower.endsWith("package.json")) {
    for (const { re, tag } of JS_RISK) {
      if (re.test(content)) {
        const sev =
          tag === "miner_hint"
            ? "critical"
            : tag === "eval" || tag === "Function_ctor"
              ? "medium"
              : "medium";
        out.push({
          severity: sev,
          category:
            tag === "miner_hint"
              ? "miner"
              : tag === "browser_token_access"
                ? "secret_harvest"
                : "shell_execution",
          title: `JavaScript indicator: ${tag}`,
          description:
            "This pattern is sometimes used legitimately (build tools) but is also common in malicious scripts.",
          evidence: { tag, path: relPath },
          filePath: relPath,
        });
      }
    }
  }

  if (/\.pyw?$/.test(ext)) {
    for (const { re, tag } of PY_RISK) {
      if (re.test(content)) {
        out.push({
          severity: "medium",
          category: "shell_execution",
          title: `Python indicator: ${tag}`,
          description:
            "Subprocess or dynamic execution can run system commands; verify intent in context.",
          evidence: { tag, path: relPath },
          filePath: relPath,
        });
      }
    }
  }

  if (lower.includes(".github/workflows/") && lower.endsWith(".yml")) {
    for (const p of WORKFLOW_EXFIL) {
      if (p.test(content)) {
        out.push({
          severity: "medium",
          category: "workflow_risk",
          title: "Workflow may expose or exfiltrate secrets",
          description:
            "CI workflows that dump secrets or pull remote scripts deserve manual review.",
          evidence: { pattern: p.source, path: relPath },
          filePath: relPath,
        });
      }
    }
  }

  const base = path.basename(relPath);
  for (const hint of cfg.doubleExtensionHints) {
    if (lower.endsWith(hint.replace(/^\./, "")) || lower.includes(hint)) {
      out.push({
        severity: "medium",
        category: "type_mismatch",
        title: "Double-extension or misleading name",
        description:
          "Filename resembles a benign document type combined with an executable extension.",
        evidence: { base, hint },
        filePath: relPath,
      });
      break;
    }
  }

  if (
    /\.(bashrc|zshrc|profile)$/i.test(base) &&
    content.includes("curl ") &&
    content.includes("|")
  ) {
    out.push({
      severity: "high",
      category: "persistence",
      title: "Shell profile with piped download",
      description:
        "Startup files that pipe downloads into a shell can establish persistence.",
      evidence: { path: relPath },
      filePath: relPath,
    });
  }

  return out;
}

export function fileMetadataHeuristics(input: {
  relativePath: string;
  extension: string;
  sizeBytes: number;
  isHidden: boolean;
  isSymlink: boolean;
  category: string;
  cfg?: HeuristicConfig;
}): HeuristicFinding[] {
  const cfg = input.cfg ?? DEFAULT_CONFIG;
  const out: HeuristicFinding[] = [];
  const ext = input.extension.toLowerCase();
  const base = path.basename(input.relativePath);

  if (input.isSymlink) {
    out.push({
      severity: "low",
      category: "archive_anomaly",
      title: "Symbolic link in tree",
      description:
        "Symlinks can point outside the repo or to sensitive locations; verify target.",
      evidence: { path: input.relativePath },
      filePath: input.relativePath,
    });
  }

  if (
    input.isHidden &&
    cfg.dangerousExtensions.some((d) => ext === d || base.endsWith(d))
  ) {
    out.push({
      severity: "medium",
      category: "hidden_binary",
      title: "Hidden executable-like file",
      description: "Hidden files with executable extensions are uncommon in benign projects.",
      evidence: { path: input.relativePath, ext },
      filePath: input.relativePath,
    });
  }

  if (input.sizeBytes > 5 * 1024 * 1024 && /\.(js|mjs|cjs)$/.test(ext)) {
    out.push({
      severity: "low",
      category: "obfuscation",
      title: "Unusually large JavaScript file",
      description:
        "Very large minified bundles can hide payloads; inspect if unexpected.",
      evidence: { sizeBytes: input.sizeBytes, path: input.relativePath },
      filePath: input.relativePath,
    });
  }

  if (
    input.category !== "scripts" &&
    input.category !== "code" &&
    [".sh", ".ps1", ".bat"].includes(ext)
  ) {
    out.push({
      severity: "medium",
      category: "shell_execution",
      title: "Script in non-code folder",
      description:
        "Shell scripts living outside typical code directories may warrant review.",
      evidence: { path: input.relativePath, category: input.category },
      filePath: input.relativePath,
    });
  }

  return out;
}
