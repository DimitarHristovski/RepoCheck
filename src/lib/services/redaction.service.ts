/**
 * Strip likely secrets and high-sensitivity tokens before optional LLM calls.
 */
const PATTERNS: { name: string; re: RegExp }[] = [
  { name: "aws_key", re: /AKIA[0-9A-Z]{16}/g },
  { name: "bearer", re: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi },
  { name: "slack_token", re: /xox[baprs]-[0-9a-zA-Z\-]{10,}/g },
  { name: "generic_secret", re: /(?:api[_-]?key|secret|token|password)\s*[:=]\s*[^\s"'`]{8,}/gi },
];

export function redactForLLM(text: string): string {
  let out = text;
  for (const { re } of PATTERNS) {
    out = out.replace(re, "[REDACTED]");
  }
  return out;
}

export function truncateForMetadata(text: string, max = 4000): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "\n…[truncated]";
}
