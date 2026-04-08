import { NextResponse } from "next/server";
import { getDashboardSnapshot } from "@/lib/store/repository";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(getDashboardSnapshot());
}
