/**
 * Short, user-facing copy for dashboard “what does this signal mean?” — static heuristics only.
 */
export function formatFindingCategory(category: string): string {
  const map: Record<string, string> = {
    shell_execution: "Shell / process execution",
    secret_harvest: "Secrets or sensitive data access",
    workflow_risk: "CI / GitHub Actions workflow",
    miner: "Cryptocurrency / mining indicator",
    secret_file: "Sensitive filename or path",
    persistence: "Startup / persistence script",
    type_mismatch: "Misleading file name",
    archive_anomaly: "Archive / symlink anomaly",
    hidden_binary: "Hidden executable-like file",
    obfuscation: "Large or obfuscated script",
    install_hooks: "Install / lifecycle scripts",
    dependency_typosquat: "Suspicious dependency name",
    network_exfil: "Network / data exfiltration hint",
    duplicate_system_name: "Duplicate file content",
    default: "General signal",
  };
  return map[category] ?? category.replace(/_/g, " ");
}

/** One sentence: what this class of finding could mean if abused (not a verdict). */
export function impactPlainLanguage(category: string): string {
  const map: Record<string, string> = {
    shell_execution:
      "If abused, code could run arbitrary commands on the machine (read files, install malware, send data out).",
    secret_harvest:
      "If abused, secrets (tokens, env vars, cookies) could be read or sent somewhere you did not intend.",
    workflow_risk:
      "If abused, CI could leak secrets or run untrusted scripts in your build environment.",
    miner:
      "Often tied to unauthorized mining; confirm whether this pattern is expected in your project.",
    secret_file:
      "These paths often hold keys or credentials; committed copies are a common leak risk.",
    persistence:
      "If malicious, this could re-run code every time a shell starts.",
    type_mismatch:
      "Attackers use double extensions to trick users into running executables.",
    archive_anomaly:
      "Symlinks can point outside the tree; verify the target is trusted.",
    hidden_binary:
      "Hidden executables are unusual; worth confirming they belong in this folder.",
    obfuscation:
      "Very large scripts can hide payloads; confirm the file is from a trusted build.",
    install_hooks:
      "Lifecycle scripts run during install; supply-chain attacks sometimes abuse them.",
    dependency_typosquat:
      "Similar-looking package names are used to trick installs; verify the package is correct.",
    network_exfil:
      "Indicates network or exfil patterns; review before trusting this code.",
    duplicate_system_name:
      "Same content in multiple files; usually benign, sometimes used to hide copies.",
    default:
      "Review in context; static rules cannot prove malicious intent.",
  };
  return map[category] ?? map.default;
}
