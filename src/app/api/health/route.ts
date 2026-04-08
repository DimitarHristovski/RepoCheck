import { NextResponse } from "next/server";
import { touchStore } from "@/lib/store/repository";

export const runtime = "nodejs";

export function GET() {
  try {
    touchStore();
    return NextResponse.json({ ok: true, service: "repocheck" });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e) },
      { status: 500 }
    );
  }
}
