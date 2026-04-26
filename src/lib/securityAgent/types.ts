/**
 * Repository security decision agent — structured types.
 * Pipeline: signals → context (trust) → score → verdict (with hard rules).
 */

export type SecurityVerdict =
  | "CLEAN"
  | "LOW_SUSPICIOUS"
  | "NEEDS_REVIEW"
  | "LIKELY_MALICIOUS"
  | "CONFIRMED_MALICIOUS";

export type ConfidenceLevel = "LOW" | "MEDIUM" | "HIGH";

/** Where the file sits in the trust model (drives score adjustments). */
export type FileTrustLevel =
  | "HIGH_PRIORITY"
  | "MEDIUM_PRIORITY"
  | "LOW_PRIORITY"
  | "UNKNOWN";

/**
 * Atomic signal kinds — auditable and mapped to base points in config.
 * Miner-related kinds should only be emitted when strong evidence exists.
 */
export type SignalKind =
  | "EVAL"
  | "FUNCTION_CONSTRUCTOR"
  | "BASE64_DECODE"
  | "STRING_RECONSTRUCT_SPLIT_JOIN"
  | "HEAVY_ESCAPES"
  | "PROCESS_ENV"
  | "DOTENV_READ"
  | "TOKEN_KEY_COOKIE_PATTERN"
  | "SSH_WALLET_PATH_REF"
  | "FETCH"
  | "AXIOS"
  | "HTTP_REQUEST_LEGACY"
  | "POST_OUTBOUND"
  | "URL_IP_LITERAL"
  | "URL_DISCORD_TELEGRAM_WEBHOOK"
  | "URL_UNKNOWN_DOMAIN"
  | "FS_MODULE"
  | "PATH_MODULE"
  | "OS_MODULE"
  | "HOME_USER_PROFILE_ACCESS"
  | "TEMP_WRITE_SENSITIVE"
  | "SENSITIVE_FILE_GLOSSARY"
  | "CHILD_PROCESS"
  | "EXEC_SPAWN_SYNC"
  | "SHELL_STRING"
  | "POWERSHELL_INVOCATION"
  | "CURL_PIPE_BASH"
  | "INSTALL_PREINSTALL"
  | "INSTALL_POSTINSTALL"
  | "INSTALL_PREPARE"
  | "CRON_OR_SCHEDULE"
  | "STARTUP_PROFILE_PERSISTENCE"
  | "LAUNCH_AGENT_STYLE"
  | "DETACHED_BACKGROUND_PROCESS"
  | "MINER_POOL_OR_STRATUM"
  | "MINER_XMRIG_MONERO_RANDOMX"
  | "MINER_WALLET_ADDRESS_STRONG"
  | "MINER_HASHING_LOOP_HINT"
  | "CONFIG_APPEND_EXECUTABLE"
  | "DOWNLOAD_THEN_EXECUTE_HINT"
  | "PACKAGE_SCRIPT_SHELL_CHAIN";

export type SignalMatch = {
  kind: SignalKind;
  filePath: string;
  /** Short quote or pattern id for audit trail */
  excerpt: string;
  lineHint?: string;
};

export type CombinationId =
  | "ENV_PLUS_NETWORK"
  | "BASE64_PLUS_EVAL"
  | "FS_PLUS_SENSITIVE_TARGET"
  | "DOWNLOAD_EXECUTE"
  | "INSTALL_HOOK_PLUS_EXECUTION"
  | "CONFIG_APPEND_EXEC"
  | "SECRET_EXFIL_UNKNOWN_DEST"
  | "PERSISTENCE_PLUS_EXECUTION";

export type CombinationHit = {
  id: CombinationId;
  points: number;
  explanation: string;
  involvedFiles: string[];
};

export type ScoredSignal = {
  match: SignalMatch;
  trustLevel: FileTrustLevel;
  basePoints: number;
  trustAdjustment: number;
  /** basePoints + trustAdjustment (before repo combinations) */
  adjustedSubtotal: number;
  explanation: string;
};

export type FileDecisionSlice = {
  path: string;
  trustLevel: FileTrustLevel;
  trustRationale: string;
  signals: ScoredSignal[];
  fileSubtotal: number;
};

export type KeyFindingRow = {
  filePath: string;
  fileTrustLevel: FileTrustLevel;
  signalTypes: SignalKind[];
  scoreContribution: number;
  explanation: string;
};

export type ContextBucket =
  | "expected_behavior"
  | "suspicious_but_explainable"
  | "dangerous"
  | "strong_evidence_malicious";

export type ContextAnalysisSection = {
  bucket: ContextBucket;
  summary: string;
  relatedPaths: string[];
};

export type SecurityAgentSummary = {
  verdict: SecurityVerdict;
  confidence: ConfidenceLevel;
  totalScore: number;
  /** Raw sum before hard-rule caps (auditing) */
  rawScoreBeforeCaps?: number;
  capsApplied: string[];
};

export type SecurityAgentReport = {
  summary: SecurityAgentSummary;
  keyFindings: KeyFindingRow[];
  contextAnalysis: ContextAnalysisSection[];
  finalReasoning: string;
  perFile: FileDecisionSlice[];
  combinationHits: CombinationHit[];
  /** Optional narrative for UI / LLM */
  pipelineNotes: string[];
};

export type AgentFileInput = {
  path: string;
  content: string;
};

export type SecurityAgentOptions = {
  /** Domains treated as lower risk for network signals (hostname, no path). */
  safeDomains?: string[];
  /** Path substrings; matches suppress “unknown domain” escalation. */
  generatedPathMarkers?: string[];
  /** If true, include example pipeline notes in report */
  debug?: boolean;
};
