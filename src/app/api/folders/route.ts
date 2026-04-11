import { NextResponse } from "next/server";
import { addApprovedFolderSchema } from "@/lib/validations/api";
import { registerApprovedFolderFromUserPath } from "@/lib/services/approvedFolderOps";
import { listApprovedFolders } from "@/lib/store/repository";

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

  const result = registerApprovedFolderFromUserPath(
    parsed.data.path,
    parsed.data.label ?? null
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ folder: result.folder });
}
