import type { CombinationHit, ScoredSignal, SignalKind } from "./types";
import { COMBINATION_POINTS } from "./config";

const envKinds: SignalKind[] = [
  "PROCESS_ENV",
  "DOTENV_READ",
  "TOKEN_KEY_COOKIE_PATTERN",
];
const networkKinds: SignalKind[] = [
  "FETCH",
  "AXIOS",
  "HTTP_REQUEST_LEGACY",
  "POST_OUTBOUND",
];
const execKinds: SignalKind[] = [
  "CHILD_PROCESS",
  "EXEC_SPAWN_SYNC",
  "SHELL_STRING",
  "CURL_PIPE_BASH",
  "POWERSHELL_INVOCATION",
  "EVAL",
  "FUNCTION_CONSTRUCTOR",
];
const installKinds: SignalKind[] = [
  "INSTALL_PREINSTALL",
  "INSTALL_POSTINSTALL",
  "INSTALL_PREPARE",
  "PACKAGE_SCRIPT_SHELL_CHAIN",
];
const persistenceKinds: SignalKind[] = [
  "CRON_OR_SCHEDULE",
  "STARTUP_PROFILE_PERSISTENCE",
  "LAUNCH_AGENT_STYLE",
  "DETACHED_BACKGROUND_PROCESS",
];

function kindsPresent(signals: ScoredSignal[]): Set<SignalKind> {
  return new Set(signals.map((s) => s.match.kind));
}

function involvedFilesFor(
  signals: ScoredSignal[],
  kinds: SignalKind[]
): string[] {
  const paths = new Set<string>();
  for (const s of signals) {
    if (kinds.includes(s.match.kind)) paths.add(s.match.filePath);
  }
  return [...paths];
}

/**
 * Repo-level correlation bonuses (§4). Each combination at most once.
 */
export function detectCombinations(all: ScoredSignal[]): CombinationHit[] {
  const hits: CombinationHit[] = [];
  const K = kindsPresent(all);
  const files = (kinds: SignalKind[]) => involvedFilesFor(all, kinds);

  const hasEnv = envKinds.some((k) => K.has(k));
  const hasNet = networkKinds.some((k) => K.has(k));
  const secretExfil =
    hasEnv &&
    K.has("URL_UNKNOWN_DOMAIN") &&
    networkKinds.some((k) => K.has(k));

  if (secretExfil) {
    hits.push({
      id: "SECRET_EXFIL_UNKNOWN_DEST",
      points: COMBINATION_POINTS.SECRET_EXFIL_UNKNOWN_DEST,
      explanation:
        "Secret/env patterns with network clients and non-allowlisted destinations.",
      involvedFiles: files([
        ...envKinds,
        "URL_UNKNOWN_DOMAIN",
        ...networkKinds,
      ]),
    });
  } else if (hasEnv && hasNet) {
    hits.push({
      id: "ENV_PLUS_NETWORK",
      points: COMBINATION_POINTS.ENV_PLUS_NETWORK,
      explanation: "Environment/credential patterns co-occur with outbound HTTP client usage.",
      involvedFiles: files([...envKinds, ...networkKinds]),
    });
  }

  if (K.has("BASE64_DECODE") && (K.has("EVAL") || K.has("FUNCTION_CONSTRUCTOR"))) {
    hits.push({
      id: "BASE64_PLUS_EVAL",
      points: COMBINATION_POINTS.BASE64_PLUS_EVAL,
      explanation: "Decoded payload near dynamic execution — common staging pattern.",
      involvedFiles: files(["BASE64_DECODE", "EVAL", "FUNCTION_CONSTRUCTOR"]),
    });
  }

  if (
    K.has("FS_MODULE") &&
    (K.has("SENSITIVE_FILE_GLOSSARY") || K.has("SSH_WALLET_PATH_REF"))
  ) {
    hits.push({
      id: "FS_PLUS_SENSITIVE_TARGET",
      points: COMBINATION_POINTS.FS_PLUS_SENSITIVE_TARGET,
      explanation: "Filesystem API combined with sensitive path targets.",
      involvedFiles: files([
        "FS_MODULE",
        "SENSITIVE_FILE_GLOSSARY",
        "SSH_WALLET_PATH_REF",
      ]),
    });
  }

  if (K.has("DOWNLOAD_THEN_EXECUTE_HINT") && execKinds.some((k) => K.has(k))) {
    hits.push({
      id: "DOWNLOAD_EXECUTE",
      points: COMBINATION_POINTS.DOWNLOAD_EXECUTE,
      explanation: "Download/fetch patterns sit near execution primitives.",
      involvedFiles: files(["DOWNLOAD_THEN_EXECUTE_HINT", ...execKinds]),
    });
  }

  if (installKinds.some((k) => K.has(k)) && execKinds.some((k) => K.has(k))) {
    hits.push({
      id: "INSTALL_HOOK_PLUS_EXECUTION",
      points: COMBINATION_POINTS.INSTALL_HOOK_PLUS_EXECUTION,
      explanation: "Lifecycle script hooks overlap with execution primitives or shell chains.",
      involvedFiles: files([...installKinds, ...execKinds]),
    });
  }

  if (K.has("CONFIG_APPEND_EXECUTABLE")) {
    hits.push({
      id: "CONFIG_APPEND_EXEC",
      points: COMBINATION_POINTS.CONFIG_APPEND_EXEC,
      explanation: "Config module appears to include extra executable block after export.",
      involvedFiles: files(["CONFIG_APPEND_EXECUTABLE"]),
    });
  }

  if (persistenceKinds.some((k) => K.has(k)) && execKinds.some((k) => K.has(k))) {
    hits.push({
      id: "PERSISTENCE_PLUS_EXECUTION",
      points: COMBINATION_POINTS.PERSISTENCE_PLUS_EXECUTION,
      explanation: "Persistence or background execution combined with command execution.",
      involvedFiles: files([...persistenceKinds, ...execKinds]),
    });
  }

  return hits;
}
