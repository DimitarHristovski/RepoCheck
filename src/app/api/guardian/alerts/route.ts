import { NextResponse } from "next/server";
import { listGuardianAlerts } from "@/lib/store/repository";
import { startGuardianService } from "@/lib/services/guardian.service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  startGuardianService();
  const { searchParams } = new URL(req.url);
  const since = searchParams.get("since")?.trim() || undefined;
  const limitRaw = Number(searchParams.get("limit") || 10);
  const limit = Number.isFinite(limitRaw) ? limitRaw : 10;

  const rows = listGuardianAlerts({ since, limit });
  return NextResponse.json({
    ok: true,
    alerts: rows.map((row) => ({
      id: row.id,
      source: row.resource ?? "unknown",
      createdAt: row.createdAt,
      detail: row.detailJson ?? {},
    })),
  });
}
