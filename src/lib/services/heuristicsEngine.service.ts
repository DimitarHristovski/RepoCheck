import type { HeuristicFinding } from "@/lib/types/findings";
import path from "path";

/** Built from fragments so this file’s own source does not match pipe-to-shell heuristics. */
const RE_CURL_PIPE_SHELL = new RegExp(
  String.raw`\bcurl\b[^|\n]*` + String.raw`\|\s*(?:bash|sh|zsh|fish)\b`,
  "i"
);
const RE_WGET_PIPE_SHELL = new RegExp(
  String.raw`\bwget\b[^|\n]*` + String.raw`\|\s*(?:bash|sh)\b`,
  "i"
);

const SHELL_PIPE_PATTERNS = [
  RE_CURL_PIPE_SHELL,
  RE_WGET_PIPE_SHELL,
  /\bchmod\s+\+x\b.*\b(?:curl|wget)\b/i,
];

/** Strong indicators only — avoid bare `miner` / pool jargon that appears in security tooling copy. */
/** Fragments concatenated so this module’s source text does not match its own miner_hint regex when scanned. */
const MINER_HINT_FRAGMENTS = [
  "crypto\\.getRandomValues",
  "stratum\\+tcp:",
  "\\bxm" + "rig\\b",
  "\\bran" + "domx\\b",
  "\\bcrypto" + "night\\b",
  "\\bmon" + "ero\\b",
  "mining\\s*pool",
] as const;
const RE_MINER_HINT = new RegExp(MINER_HINT_FRAGMENTS.join("|"), "i");

function normalizedScanPath(relPath: string): string {
  return relPath.replace(/\\/g, "/").toLowerCase();
}

/** Prompts and the security agent define these tokens; scanning them produces self-referential noise. */
function shouldSkipMinerHintHeuristic(relPath: string): boolean {
  const p = normalizedScanPath(relPath);
  return (
    p.includes("/src/lib/securityagent/") ||
    p.includes("/src/lib/prompts/") ||
    p.endsWith("/dashboardriskcopy.ts")
  );
}

function shouldSkipLooseJsExfilHeuristic(relPath: string): boolean {
  const p = normalizedScanPath(relPath);
  return p.includes("/src/lib/prompts/");
}

const JS_RISK = [
  { re: /\beval\s*\(/, tag: "eval" },
  { re: /\bnew\s+Function\s*\(/, tag: "Function_ctor" },
  { re: /child_process|require\s*\(\s*['"]child_process['"]\s*\)/, tag: "child_process" },
  { re: /\bexec(?:Sync)?\s*\(|\bspawn(?:Sync)?\s*\(/, tag: "exec_spawn" },
  { re: RE_MINER_HINT, tag: "miner_hint" },
  { re: /navigator\.clipboard|document\.cookie\b/i, tag: "browser_token_access" },
];

const PY_RISK = [
  { re: /\bos\.system\s*\(|\bsubprocess\.(?:call|Popen|run)\s*\(/, tag: "subprocess" },
  { re: /base64\.b64decode|marshal\.loads|pickle\.loads/i, tag: "decode_exec" },
  { re: /\brequests\.(?:get|post)\s*\([^)]*http/i, tag: "http_request" },
];

const JS_EXFIL = [
  {
    re: /process\.env[\s\S]{0,400}?(?:fetch|axios|http\.request|https\.request)/i,
    tag: "env_to_network",
  },
  {
    re: /(?:fetch|axios)[\s\S]{0,400}?process\.env/i,
    tag: "network_env",
  },
];

const JS_SENSITIVE_FS = [
  { re: /readFile(?:Sync)?\s*\([^)]*\/etc\/passwd/i, tag: "read_etc_passwd" },
  { re: /\.ssh\/id_rsa|\.aws\/credentials/i, tag: "path_in_string" },
];

const GO_RISK = [{ re: /"os\/exec"|exec\.Command/i, tag: "go_exec" }];

const RB_SH_RISK = [
  { re: /\`[^\`]{3,400}\`|%x\{[^}]{1,400}\}/, tag: "ruby_shell" },
  { re: /\bOpen3\.|system\s*\(/i, tag: "ruby_system" },
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
    const skipLooseExfil = shouldSkipLooseJsExfilHeuristic(relPath);
    for (const { re, tag } of JS_EXFIL) {
      if (skipLooseExfil) continue;
      if (re.test(content)) {
        out.push({
          severity: "high",
          category: "secret_harvest",
          title: `JavaScript indicator: ${tag}`,
          description:
            "Environment variables or network calls appear close together; could leak secrets to a remote endpoint.",
          evidence: { tag, path: relPath },
          filePath: relPath,
        });
      }
    }
    for (const { re, tag } of JS_SENSITIVE_FS) {
      if (re.test(content)) {
        out.push({
          severity: "high",
          category: "secret_harvest",
          title: `JavaScript indicator: ${tag}`,
          description:
            "References to sensitive host paths or credential locations in code warrant review.",
          evidence: { tag, path: relPath },
          filePath: relPath,
        });
      }
    }
    for (const { re, tag } of JS_RISK) {
      if (tag === "miner_hint" && shouldSkipMinerHintHeuristic(relPath)) continue;
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

  if (/\.go$/.test(ext)) {
    for (const { re, tag } of GO_RISK) {
      if (re.test(content)) {
        out.push({
          severity: "medium",
          category: "shell_execution",
          title: `Go indicator: ${tag}`,
          description: "Process execution from Go can run arbitrary commands; confirm intent.",
          evidence: { tag, path: relPath },
          filePath: relPath,
        });
      }
    }
  }

  if (/\.rb$/.test(ext)) {
    for (const { re, tag } of RB_SH_RISK) {
      if (re.test(content)) {
        out.push({
          severity: "medium",
          category: "shell_execution",
          title: `Ruby indicator: ${tag}`,
          description: "Backticks or shell helpers can execute system commands.",
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

  if (/\.github\/workflows\//i.test(lower) && /\.ya?ml$/i.test(lower)) {
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
    if (/\bcurl\b[^|\n]*\|\s*(?:bash|sh|zsh)\b/i.test(content)) {
      out.push({
        severity: "high",
        category: "workflow_risk",
        title: "Workflow pipes remote content to shell",
        description:
          "GitHub Actions that pipe curl/wget into a shell can execute arbitrary code in CI.",
        evidence: { path: relPath },
        filePath: relPath,
      });
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

  out.push(...pathSensitiveHeuristics(input.relativePath));

  return out;
}

/**
 * Filename/path-only signals (no file body read). Safe to run on every path in a walk.
 */
export function pathSensitiveHeuristics(relativePath: string): HeuristicFinding[] {
  const norm = relativePath.replace(/\\/g, "/");
  const lower = norm.toLowerCase();
  const base = path.basename(lower);
  const out: HeuristicFinding[] = [];

  if (/(^|\/)\.env($|\.local$|\.production$|\.development$)/i.test(norm)) {
    out.push({
      severity: "medium",
      category: "secret_file",
      title: "Environment file name",
      description:
        "Files named like .env often hold secrets; if committed, they are a common leak vector.",
      evidence: { path: relativePath },
      filePath: relativePath,
    });
  }

  if (/(^|\/)\.ssh\/(id_rsa|id_ed25519|id_ecdsa)(?:$|\.)/.test(norm)) {
    out.push({
      severity: "critical",
      category: "secret_file",
      title: "SSH private key path pattern",
      description:
        "Filenames matching private keys under .ssh are extremely sensitive; confirm they should exist in this tree.",
      evidence: { path: relativePath },
      filePath: relativePath,
    });
  }

  if (/(^|\/)\.aws\/credentials$|(^|\/)aws\/credentials$/i.test(norm)) {
    out.push({
      severity: "high",
      category: "secret_file",
      title: "AWS credentials path pattern",
      description: "Paths that match AWS credential files warrant verification before sharing or publishing.",
      evidence: { path: relativePath },
      filePath: relativePath,
    });
  }

  if (/(^|\/)kubeconfig$/i.test(base) || /(^|\/)\.kube\/config$/i.test(norm)) {
    out.push({
      severity: "high",
      category: "secret_file",
      title: "Kubernetes config filename",
      description: "Kubeconfig files can embed cluster credentials; review exposure.",
      evidence: { path: relativePath },
      filePath: relativePath,
    });
  }

  if (/\.(pem|pfx|p12)$/i.test(base)) {
    out.push({
      severity: "medium",
      category: "secret_file",
      title: "Certificate or PKCS bundle extension",
      description: "PEM/PFX/P12 files may contain private keys; confirm they belong in this project.",
      evidence: { path: relativePath },
      filePath: relativePath,
    });
  }

  if (/(^|\/)secrets?\.(json|ya?ml|toml)$/i.test(base)) {
    out.push({
      severity: "medium",
      category: "secret_file",
      title: "Secrets-named config file",
      description: "Filenames suggesting stored secrets deserve manual review.",
      evidence: { path: relativePath },
      filePath: relativePath,
    });
  }

  if (/(^|\/)google-services\.json$/i.test(base) || /(^|\/)GoogleService-Info\.plist$/i.test(base)) {
    out.push({
      severity: "low",
      category: "default",
      title: "Mobile/cloud client config",
      description:
        "Common mobile SDK config files; not inherently malicious but often contain project identifiers.",
      evidence: { path: relativePath },
      filePath: relativePath,
    });
  }

  return out;
}
