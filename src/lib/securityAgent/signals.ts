import type { SignalKind, SignalMatch } from "./types";

function pushUnique(
  out: SignalMatch[],
  seen: Set<string>,
  m: Omit<SignalMatch, "filePath"> & { filePath: string }
) {
  const key = `${m.kind}:${m.excerpt.slice(0, 80)}`;
  if (seen.has(key)) return;
  seen.add(key);
  out.push(m);
}

function isSafeHost(host: string, safeDomains: Set<string>): boolean {
  const h = host.toLowerCase().split(":")[0] ?? host;
  if (h === "localhost" || h === "127.0.0.1" || h === "[::1]") return true;
  if (safeDomains.has(h)) return true;
  for (const d of safeDomains) {
    if (h === d || h.endsWith(`.${d}`)) return true;
  }
  return false;
}

const RE_IP_HOST = /^\d{1,3}(?:\.\d{1,3}){3}$|^\[[0-9a-f:]+\]$/i;

/** Strong miner / pool indicators only (§2 miner signals). */
const MINER_STRONG = [
  /\bstratum\+tcp:/i,
  /\bxmrig\b/i,
  /\bmonero\b/i,
  /\brandomx\b/i,
  /\bmining\s*pool\b/i,
  /\bcryptonight\b/i,
];

const WALLET_LIKE = /\b(?:0x[a-fA-F0-9]{40}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{20,})\b/;

export function extractSignalsFromContent(
  filePath: string,
  content: string,
  safeDomains: string[]
): SignalMatch[] {
  const safe = new Set(safeDomains.map((s) => s.toLowerCase()));
  const out: SignalMatch[] = [];
  const seen = new Set<string>();
  const add = (kind: SignalKind, excerpt: string) =>
    pushUnique(out, seen, { kind, filePath, excerpt });

  const lowerPath = filePath.replace(/\\/g, "/").toLowerCase();

  // --- Dangerous execution ---
  if (/\brequire\s*\(\s*['"]child_process['"]\s*\)|\bchild_process\b/.test(content)) {
    add("CHILD_PROCESS", "child_process");
  }
  if (/\bexec(?:Sync)?\s*\(|\bspawn(?:Sync)?\s*\(/.test(content)) {
    add("EXEC_SPAWN_SYNC", "exec/spawn");
  }
  if (/\b(?:bash|sh|zsh)\s+-c\b/.test(content)) {
    add("SHELL_STRING", "shell -c");
  }
  if (/\b(?:powershell|pwsh)\b/i.test(content)) {
    add("POWERSHELL_INVOCATION", "powershell/pwsh");
  }
  if (/\bcurl\b[^|\n]{0,120}\|\s*(?:bash|sh|zsh|fish)\b/i.test(content)) {
    add("CURL_PIPE_BASH", "curl|bash");
  }

  // --- Obfuscation ---
  if (/\beval\s*\(/.test(content)) add("EVAL", "eval(");
  if (/\bnew\s+Function\s*\(/.test(content)) add("FUNCTION_CONSTRUCTOR", "new Function(");
  if (/atob\s*\(|Buffer\.from\s*\([^,]+,\s*['"]base64['"]|from\s+['"]base64['"]/i.test(content)) {
    add("BASE64_DECODE", "base64 decode");
  }
  if (/\.split\s*\(\s*['"][^'"]+['"]\s*\)\s*\.join\s*\(/i.test(content)) {
    add("STRING_RECONSTRUCT_SPLIT_JOIN", "split().join()");
  }
  if (/(\\x[0-9a-fA-F]{2}){8,}|\\u[0-9a-fA-F]{4}/i.test(content)) {
    add("HEAVY_ESCAPES", "heavy hex/unicode escapes");
  }

  // --- Secrets ---
  if (/\bprocess\.env\b/.test(content)) add("PROCESS_ENV", "process.env");
  if (/readFile(?:Sync)?\s*\([^)]*\.env/i.test(content) || /\bdotenv\b/.test(content)) {
    add("DOTENV_READ", ".env / dotenv");
  }
  if (/\b(?:api[_-]?key|secret|token|password|bearer|authorization)\b/i.test(content)) {
    add("TOKEN_KEY_COOKIE_PATTERN", "credential-like identifiers");
  }
  if (/\.ssh\/|id_rsa|\.aws\/credentials|wallet\.dat|metamask/i.test(content)) {
    add("SSH_WALLET_PATH_REF", "sensitive path reference");
  }

  // --- Network ---
  if (/\bfetch\s*\(/.test(content)) add("FETCH", "fetch(");
  if (/\baxios\b/.test(content)) add("AXIOS", "axios");
  if (/\brequire\s*\(\s*['"]https?['"]\s*\)|\bhttps?\.request\s*\(/.test(content)) {
    add("HTTP_REQUEST_LEGACY", "http/https request");
  }
  if (/\bmethod\s*:\s*['"]POST['"]|\.post\s*\(/i.test(content)) {
    add("POST_OUTBOUND", "POST pattern");
  }

  const urlRe = /https?:\/\/([^\/"'`\s<>]+)(\/[^\s"'`]*)?/gi;
  let um: RegExpExecArray | null;
  const urlHosts = new Set<string>();
  while ((um = urlRe.exec(content)) !== null) {
    urlHosts.add(um[1]!);
  }
  if (/discord(?:app)?\.com\/api\/webhooks/i.test(content) || /api\.telegram\.org/i.test(content)) {
    add("URL_DISCORD_TELEGRAM_WEBHOOK", "discord/telegram/webhook style");
  }
  for (const host of urlHosts) {
    const h = host.toLowerCase();
    if (RE_IP_HOST.test(h.replace(/:\d+$/, ""))) {
      add("URL_IP_LITERAL", host);
    }
    if (!isSafeHost(h, safe)) {
      add("URL_UNKNOWN_DOMAIN", host);
    }
  }

  // --- FS / OS ---
  if (/\brequire\s*\(\s*['"]fs['"]\s*\)|\bfrom\s+['"]fs['"]|node:fs/.test(content)) {
    add("FS_MODULE", "fs");
  }
  if (/\brequire\s*\(\s*['"]path['"]\s*\)|node:path/.test(content)) {
    add("PATH_MODULE", "path");
  }
  if (/\brequire\s*\(\s*['"]os['"]\s*\)|node:os/.test(content)) {
    add("OS_MODULE", "os");
  }
  if (/os\.homedir|process\.env\.(?:HOME|USERPROFILE)|\/Users\/|\\\\Users\\\\/i.test(content)) {
    add("HOME_USER_PROFILE_ACCESS", "home/user profile");
  }
  if (/mkdtemp|tmpdir|\/tmp\/|os\.tmpdir/i.test(content) && /write|create|spawn/i.test(content)) {
    add("TEMP_WRITE_SENSITIVE", "temp + write/exec");
  }
  if (/\/etc\/passwd|\/etc\/shadow|\.ssh\/authorized_keys/i.test(content)) {
    add("SENSITIVE_FILE_GLOSSARY", "sensitive system path");
  }

  // --- Persistence ---
  if (/\bcron\.|crontab|@daily|launchctl|LaunchAgent|scheduled task|schtasks/i.test(content)) {
    add("CRON_OR_SCHEDULE", "cron/scheduler");
  }
  if (/\.(bashrc|zshrc|profile)$/i.test(lowerPath) && /curl|wget/i.test(content)) {
    add("STARTUP_PROFILE_PERSISTENCE", "profile + fetch");
  }
  if (/Library\/LaunchAgents|\.plist.*Label/i.test(content)) {
    add("LAUNCH_AGENT_STYLE", "launch agent pattern");
  }
  if (/\bdetached\s*:\s*true|unref\s*\(|spawn\([^)]*stdio:\s*['"]ignore['"]/i.test(content)) {
    add("DETACHED_BACKGROUND_PROCESS", "detached process");
  }

  // --- Miner: strong only ---
  for (const re of MINER_STRONG) {
    if (re.test(content)) {
      add("MINER_XMRIG_MONERO_RANDOMX", re.source);
      break;
    }
  }
  if (/\bstratum\+tcp:/i.test(content)) {
    add("MINER_POOL_OR_STRATUM", "stratum");
  }
  if (WALLET_LIKE.test(content) && /(?:hash|mine|pool|stratum|nonce)/i.test(content)) {
    add("MINER_WALLET_ADDRESS_STRONG", "wallet + mining context");
  }
  if (/\bfor\s*\([^)]*\)\s*\{[^}]{0,200}sha256|crypto\.createHash[\s\S]{0,400}for\s*\(/i.test(content)) {
    add("MINER_HASHING_LOOP_HINT", "tight hash loop hint");
  }

  // --- Config file executable append (§7) ---
  if (/\.(config\.(js|cjs|mjs)|rc\.(js|cjs))$/i.test(lowerPath) || /next\.config\.(js|mjs|cjs)/i.test(lowerPath)) {
    if (
      /module\.exports\s*=|export\s+default/.test(content) &&
      /\)\s*\(\s*\)\s*;|\(function\s*\([^)]*\)\s*\{/.test(content) &&
      content.split(/module\.exports\s*=\s*|export\s+default/).length > 1
    ) {
      const idx = content.lastIndexOf("(function");
      if (idx > 200 && idx < content.length - 20) {
        add("CONFIG_APPEND_EXECUTABLE", "IIFE / extra executable block after export");
      }
    }
  }

  // Download + execute hint
  if (
    /(?:fetch|axios|get|download)[\s\S]{0,300}(?:exec|spawn|chmod|eval)/i.test(content) ||
    /(?:curl|wget)[\s\S]{0,200}(?:chmod|exec|bash|sh\s)/i.test(content)
  ) {
    add("DOWNLOAD_THEN_EXECUTE_HINT", "download near execution");
  }

  return out;
}

export function extractPackageJsonScriptSignals(
  filePath: string,
  content: string
): SignalMatch[] {
  const out: SignalMatch[] = [];
  if (!filePath.replace(/\\/g, "/").toLowerCase().endsWith("package.json")) return out;
  let pkg: { scripts?: Record<string, string> };
  try {
    pkg = JSON.parse(content) as { scripts?: Record<string, string> };
  } catch {
    return out;
  }
  const scripts = pkg.scripts ?? {};
  const hooks = ["preinstall", "postinstall", "prepare"] as const;
  const add = (kind: SignalKind, excerpt: string) =>
    out.push({ kind, filePath, excerpt });
  for (const h of hooks) {
    const s = scripts[h];
    if (typeof s === "string" && s.trim()) {
      add(
        h === "preinstall"
          ? "INSTALL_PREINSTALL"
          : h === "postinstall"
            ? "INSTALL_POSTINSTALL"
            : "INSTALL_PREPARE",
        `${h}: ${s.slice(0, 120)}`
      );
      if (/curl|wget|bash|sh |node\s+\.|\.sh|powershell/i.test(s)) {
        add("PACKAGE_SCRIPT_SHELL_CHAIN", `${h} uses shell/network`);
      }
    }
  }
  return out;
}
