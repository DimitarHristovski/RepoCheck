import { NextResponse } from "next/server";
import { z } from "zod";
import { runRepoCheckWorkflow } from "@/lib/graph/repoCheckGraph";
import { listApprovedFolderPaths } from "@/lib/approvedFolders";
import type { GraphRequestType } from "@/lib/graph/state";

export const runtime = "nodejs";

const bodySchema = z.object({
  requestType: z.enum([
    "file_organization",
    "folder_protection",
    "repo_scan",
    "mixed",
  ]),
  approvedFolderPath: z.string().optional(),
  repoLocalPath: z.string().optional(),
  privacyMetadataOnly: z.boolean().optional().default(true),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const approvedRoots = listApprovedFolderPaths();
  if (!approvedRoots.length) {
    return NextResponse.json(
      { error: "Configure approved folders first" },
      { status: 400 }
    );
  }
  const state = await runRepoCheckWorkflow({
    requestType: parsed.data.requestType as GraphRequestType,
    approvedFolderPath: parsed.data.approvedFolderPath,
    repoLocalPath: parsed.data.repoLocalPath,
    approvedRoots,
    privacyMetadataOnly: parsed.data.privacyMetadataOnly ?? true,
  });
  return NextResponse.json({ state });
}
