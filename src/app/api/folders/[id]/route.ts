import { NextResponse } from "next/server";
import { deleteApprovedFolder } from "@/lib/store/repository";
import { writeAuditLog } from "@/lib/services/auditLog.service";

export const runtime = "nodejs";

export function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return (async () => {
    const { id } = await ctx.params;
    const row = deleteApprovedFolder(id);
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    writeAuditLog({
      actor: "user",
      action: "approved_folder_remove",
      resource: row.path,
    });
    return NextResponse.json({ ok: true });
  })();
}
