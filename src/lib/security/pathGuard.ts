import fs from "fs";
import path from "path";
import { realpathSync } from "fs";

/**
 * Normalize and resolve; reject if outside any allowed root.
 * Does not follow symlinks beyond the final resolved path check.
 */
export function assertPathUnderApprovedRoots(
  candidatePath: string,
  approvedRoots: string[]
): string {
  if (!approvedRoots.length) {
    throw new Error("No approved folders configured");
  }
  const normalized = path.normalize(candidatePath);
  let resolved: string;
  try {
    resolved = fs.realpathSync.native
      ? fs.realpathSync.native(normalized)
      : realpathSync(normalized);
  } catch {
    resolved = path.resolve(normalized);
  }
  const roots = approvedRoots.map((r) => {
    try {
      return fs.realpathSync.native
        ? fs.realpathSync.native(path.resolve(r))
        : realpathSync(path.resolve(r));
    } catch {
      return path.resolve(r);
    }
  });
  const ok = roots.some(
    (root) =>
      resolved === root ||
      resolved.startsWith(root + path.sep) ||
      (process.platform === "win32" &&
        resolved.toLowerCase().startsWith(root.toLowerCase() + path.sep))
  );
  if (!ok) {
    throw new Error("Path traversal or path outside approved folders");
  }
  return resolved;
}

export function isPathUnderRoot(target: string, root: string): boolean {
  const r = path.resolve(root);
  const t = path.resolve(target);
  return t === r || t.startsWith(r + path.sep);
}
