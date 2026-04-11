import fs from "fs";
import os from "os";
import path from "path";

/**
 * Resolve user input to an absolute path: expands `~`, trims, normalizes.
 */
export function resolveUserInputPath(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (trimmed === "~") {
    return os.homedir();
  }
  if (trimmed.startsWith("~/") || trimmed.startsWith("~\\")) {
    return path.join(os.homedir(), trimmed.slice(2));
  }
  return path.resolve(trimmed);
}

export function isExistingDirectory(absPath: string): boolean {
  try {
    return fs.existsSync(absPath) && fs.statSync(absPath).isDirectory();
  } catch {
    return false;
  }
}
