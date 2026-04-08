import fs from "fs";
import path from "path";
import { assertPathUnderApprovedRoots } from "@/lib/security/pathGuard";
import { writeAuditLog } from "@/lib/services/auditLog.service";

/**
 * Executes only reversible moves strictly inside approved roots. No deletes.
 */
export function executeMoveWithinRoot(input: {
  fromAbsolute: string;
  toAbsolute: string;
  approvedRoots: string[];
}): { ok: true } | { ok: false; error: string } {
  try {
    const from = assertPathUnderApprovedRoots(input.fromAbsolute, input.approvedRoots);
    const to = assertPathUnderApprovedRoots(input.toAbsolute, input.approvedRoots);
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
