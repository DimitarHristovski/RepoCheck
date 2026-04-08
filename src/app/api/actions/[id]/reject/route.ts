import { NextResponse } from "next/server";
import { getProposedActionById, setProposedActionStatus } from "@/lib/store/repository";
import { writeAuditLog } from "@/lib/services/auditLog.service";

export const runtime = "nodejs";

export function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return (async () => {
    const { id } = await ctx.params;
    if (!getProposedActionById(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    setProposedActionStatus(id, "rejected");
    writeAuditLog({
      actor: "user",
      action: "proposed_action_rejected",
      resource: id,
    });
    return NextResponse.json({ ok: true });
  })();
}
