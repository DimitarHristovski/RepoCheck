import { NextResponse } from "next/server";
import { z } from "zod";
import { clearLocalData } from "@/lib/store/repository";

export const runtime = "nodejs";

const bodySchema = z.object({
  scope: z.enum(["scans", "folders", "all"]),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  clearLocalData(parsed.data.scope);
  return NextResponse.json({ ok: true });
}
