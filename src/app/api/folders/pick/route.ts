import { NextResponse } from "next/server";
import { pickFolderNative } from "@/lib/server/nativeFolderPicker";
import { registerApprovedFolderFromUserPath } from "@/lib/services/approvedFolderOps";

export const runtime = "nodejs";

/**
 * Opens the OS folder picker (macOS / Windows / Linux with zenity), then registers the folder like POST /api/folders.
 */
export function POST() {
  const picked = pickFolderNative();
  if (!picked.path) {
    return NextResponse.json(
      {
        error: picked.reason ?? "No folder selected",
        cancelled: true,
      },
      { status: 400 }
    );
  }

  const result = registerApprovedFolderFromUserPath(picked.path, null);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ folder: result.folder });
}
