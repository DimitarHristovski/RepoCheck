import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import {
  getApprovedFolderById,
  getApprovedFolderByPath,
  insertApprovedFolder,
  listApprovedFolders,
} from "@/lib/store/repository";
import { addApprovedFolderSchema } from "@/lib/validations/api";
import { writeAuditLog } from "@/lib/services/auditLog.service";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({ folders: listApprovedFolders() });
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = addApprovedFolderSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const candidate = path.resolve(parsed.data.path);
  if (!fs.existsSync(candidate) || !fs.statSync(candidate).isDirectory()) {
    return NextResponse.json(
      { error: "Path must be an existing directory" },
      { status: 400 }
    );
  }
  const resolved = fs.realpathSync(candidate);
  if (!fs.statSync(resolved).isDirectory()) {
    return NextResponse.json(
      { error: "Path must be an existing directory" },
      { status: 400 }
    );
  }
  const existing = getApprovedFolderByPath(resolved);
  if (existing) {
    return NextResponse.json({ folder: existing });
  }
  const id = randomUUID();
  insertApprovedFolder({
    id,
    path: resolved,
    label: parsed.data.label ?? null,
  });
  writeAuditLog({
    actor: "user",
    action: "approved_folder_add",
    resource: resolved,
  });
  const row = getApprovedFolderById(id);
  return NextResponse.json({ folder: row });
}
