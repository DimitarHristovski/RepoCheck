import type { CombinationId, SignalKind } from "./types";

/** Default safe destinations (hostname only, lowercase). */
export const DEFAULT_SAFE_DOMAINS: string[] = [
  "openai.com",
  "api.openai.com",
  "googleapis.com",
  "www.googleapis.com",
  "github.com",
  "api.github.com",
  "npmjs.org",
  "registry.npmjs.org",
  "unpkg.com",
  "jsdelivr.net",
  "localhost",
  "127.0.0.1",
];

/** Paths treated as generated / low evidentiary value. */
export const DEFAULT_GENERATED_MARKERS: string[] = [
  "/.next/",
  "/dist/",
  "/build/",
  "vendor-chunks",
  ".min.js",
  ".min.mjs",
  ".min.cjs",
];

/** Base points per user specification §4. */
export const BASE_SIGNAL_POINTS: Record<SignalKind, number> = {
  EVAL: 1,
  FUNCTION_CONSTRUCTOR: 1,
  BASE64_DECODE: 1,
  STRING_RECONSTRUCT_SPLIT_JOIN: 1,
  HEAVY_ESCAPES: 1,
  PROCESS_ENV: 1,
  DOTENV_READ: 1,
  TOKEN_KEY_COOKIE_PATTERN: 1,
  SSH_WALLET_PATH_REF: 1,
  FETCH: 1,
  AXIOS: 1,
  HTTP_REQUEST_LEGACY: 1,
  POST_OUTBOUND: 1,
  URL_IP_LITERAL: 1,
  URL_DISCORD_TELEGRAM_WEBHOOK: 1,
  URL_UNKNOWN_DOMAIN: 1,
  FS_MODULE: 1,
  PATH_MODULE: 1,
  OS_MODULE: 1,
  HOME_USER_PROFILE_ACCESS: 2,
  TEMP_WRITE_SENSITIVE: 2,
  SENSITIVE_FILE_GLOSSARY: 2,
  CHILD_PROCESS: 3,
  EXEC_SPAWN_SYNC: 3,
  SHELL_STRING: 3,
  POWERSHELL_INVOCATION: 3,
  CURL_PIPE_BASH: 3,
  INSTALL_PREINSTALL: 4,
  INSTALL_POSTINSTALL: 4,
  INSTALL_PREPARE: 4,
  CRON_OR_SCHEDULE: 4,
  STARTUP_PROFILE_PERSISTENCE: 4,
  LAUNCH_AGENT_STYLE: 4,
  DETACHED_BACKGROUND_PROCESS: 4,
  MINER_POOL_OR_STRATUM: 5,
  MINER_XMRIG_MONERO_RANDOMX: 5,
  MINER_WALLET_ADDRESS_STRONG: 5,
  MINER_HASHING_LOOP_HINT: 5,
  /** Pattern flagged for audit; combination layer adds +6 via CONFIG_APPEND_EXEC. */
  CONFIG_APPEND_EXECUTABLE: 0,
  /** Triggers DOWNLOAD_EXECUTE (+5) when paired with execution signals. */
  DOWNLOAD_THEN_EXECUTE_HINT: 0,
  PACKAGE_SCRIPT_SHELL_CHAIN: 3,
};

/** Combination bonuses §4. */
export const COMBINATION_POINTS: Record<CombinationId, number> = {
  ENV_PLUS_NETWORK: 2,
  BASE64_PLUS_EVAL: 2,
  FS_PLUS_SENSITIVE_TARGET: 3,
  DOWNLOAD_EXECUTE: 5,
  INSTALL_HOOK_PLUS_EXECUTION: 6,
  CONFIG_APPEND_EXEC: 6,
  SECRET_EXFIL_UNKNOWN_DEST: 8,
  PERSISTENCE_PLUS_EXECUTION: 8,
};

/** Trust adjustments per signal occurrence (applied to that signal’s points). */
export const TRUST_DELTA: Record<
  "HIGH_PRIORITY" | "MEDIUM_PRIORITY" | "LOW_PRIORITY" | "UNKNOWN",
  number
> = {
  HIGH_PRIORITY: 0,
  MEDIUM_PRIORITY: 0,
  LOW_PRIORITY: -3,
  UNKNOWN: 0,
};

export const GENERATED_EXTRA_DELTA = -2;

/** Verdict thresholds (inclusive upper bound for band, except CONFIRMED). */
export const VERDICT_THRESHOLDS = {
  CLEAN_MAX: 2,
  LOW_SUSPICIOUS_MAX: 5,
  NEEDS_REVIEW_MAX: 8,
  LIKELY_MALICIOUS_MAX: 12,
} as const;
