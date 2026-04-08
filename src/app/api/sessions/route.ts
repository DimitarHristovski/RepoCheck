import { NextResponse } from "next/server";
import { listScanSessions } from "@/lib/store/repository";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({ sessions: listScanSessions(50) });
}
