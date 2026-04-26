import fs from "fs";
import path from "path";
import { writeAuditLog } from "@/lib/services/auditLog.service";

/**
 * Executes reversible moves (e.g. from legacy planned actions). Paths must resolve to real files.
 */
export function executeMoveWithinRoot(input: {
  fromAbsolute: string;
  toAbsolute: string;
}): { ok: true } | { ok: false; error: string } {
  try {
    const from = path.resolve(input.fromAbsolute);
    const to = path.resolve(input.toAbsolute);
    if (!fs.existsSync(from)) {
      return { ok: false, error: `Source does not exist: ${from}` };
    }
    const toDir = path.dirname(to);
    fs.mkdirSync(toDir, { recursive: true });
    fs.renameSync(from, to);
    writeAuditLog({
      actor: "user",
      action: "file_move",
      resource: from,
      detail: { to },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
