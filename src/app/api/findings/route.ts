import { NextResponse } from "next/server";
import { z } from "zod";
import { listFindingsFiltered } from "@/lib/store/repository";

export const runtime = "nodejs";

const severitySchema = z.enum(["info", "low", "medium", "high", "critical"]);

export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  const severityRaw = searchParams.get("severity");
  const severityParsed = severityRaw
    ? severitySchema.safeParse(severityRaw)
    : null;
  const severity =
    severityParsed && severityParsed.success ? severityParsed.data : null;

  if (sessionId && severity) {
    return NextResponse.json({
      findings: listFindingsFiltered({ sessionId, severity }),
    });
  }

  if (sessionId) {
    return NextResponse.json({
      findings: listFindingsFiltered({ sessionId }),
    });
  }

  const rows = listFindingsFiltered({ limit: 200 });
  const filtered =
    severity && !sessionId
      ? rows.filter((f) => f.severity === severity)
      : rows;
  return NextResponse.json({ findings: filtered });
}
