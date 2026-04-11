import fs from "fs";
import { randomUUID } from "crypto";
import {
  getApprovedFolderById,
  getApprovedFolderByPath,
  insertApprovedFolder,
} from "@/lib/store/repository";
import { writeAuditLog } from "@/lib/services/auditLog.service";
import type { ApprovedFolderRow } from "@/lib/store/types";
import {
  isExistingDirectory,
  resolveUserInputPath,
} from "@/lib/server/resolveUserPath";

export type RegisterFolderResult =
  | { ok: true; folder: ApprovedFolderRow; duplicate: boolean }
  | { ok: false; error: string };

/**
 * Validates path, resolves symlinks, inserts if new. Accepts `~` and relative paths.
 */
export function registerApprovedFolderFromUserPath(
  rawPath: string,
  label?: string | null
): RegisterFolderResult {
  const candidate = resolveUserInputPath(rawPath);
  if (!candidate) {
    return { ok: false, error: "Path is empty" };
  }
  if (!isExistingDirectory(candidate)) {
    return {
      ok: false,
      error:
        "That path is not an existing directory. Check spelling, use an absolute path, or try ~/YourFolder",
    };
  }
  let resolved: string;
  try {
    resolved = fs.realpathSync(candidate);
  } catch {
    return { ok: false, error: "Could not resolve that path (permissions or symlink?)" };
  }
  if (!fs.statSync(resolved).isDirectory()) {
    return { ok: false, error: "Path must be a directory" };
  }

  const existing = getApprovedFolderByPath(resolved);
  if (existing) {
    return { ok: true, folder: existing, duplicate: true };
  }

  const id = randomUUID();
  insertApprovedFolder({
    id,
    path: resolved,
    label: label ?? null,
  });
  writeAuditLog({
    actor: "user",
    action: "approved_folder_add",
    resource: resolved,
  });
  const row = getApprovedFolderById(id);
  if (!row) {
    return { ok: false, error: "Failed to save approved folder" };
  }
  return { ok: true, folder: row, duplicate: false };
}
