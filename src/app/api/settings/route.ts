import { NextResponse } from "next/server";
import { settingsPatchSchema } from "@/lib/validations/api";
import { getAppSettings, setAppSettings } from "@/lib/settingsStore";
import { writeAuditLog } from "@/lib/services/auditLog.service";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({ settings: getAppSettings() });
}

export async function PATCH(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = settingsPatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const next = setAppSettings(parsed.data);
  writeAuditLog({ actor: "user", action: "settings_update" });
  return NextResponse.json({ settings: next });
}
