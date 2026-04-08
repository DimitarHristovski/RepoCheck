import { NextResponse } from "next/server";
import { z } from "zod";
import { getFindingById, updateFindingReviewed } from "@/lib/store/repository";

export const runtime = "nodejs";

const patchSchema = z.object({
  reviewed: z.boolean(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (!getFindingById(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const updated = updateFindingReviewed(id, parsed.data.reviewed);
  return NextResponse.json({ finding: updated });
}
