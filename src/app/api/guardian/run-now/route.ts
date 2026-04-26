import { NextResponse } from "next/server";
import { runGuardianNow, startGuardianService } from "@/lib/services/guardian.service";

export const runtime = "nodejs";

export async function POST() {
  startGuardianService();
  try {
    await runGuardianNow();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

