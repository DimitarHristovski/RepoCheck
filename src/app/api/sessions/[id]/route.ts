import { NextResponse } from "next/server";
import { getSessionBundle } from "@/lib/store/repository";

export const runtime = "nodejs";

export function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  return (async () => {
    const { id } = await ctx.params;
    const bundle = getSessionBundle(id);
    if (!bundle.session) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({
      session: bundle.session,
      scannedItems: bundle.scannedItems,
      findings: bundle.findings,
      riskScores: bundle.riskScores,
      proposedActions: bundle.proposedActions,
    });
  })();
}
