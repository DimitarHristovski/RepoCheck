import { NextResponse } from "next/server";
import { z } from "zod";
import { runRepoCheckWorkflow } from "@/lib/graph/repoCheckGraph";

export const runtime = "nodejs";

const bodySchema = z.object({
  requestType: z.literal("repo_scan"),
  repoLocalPath: z.string().min(1),
  privacyMetadataOnly: z.boolean().optional().default(true),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const state = await runRepoCheckWorkflow({
    requestType: "repo_scan",
    repoLocalPath: parsed.data.repoLocalPath,
    privacyMetadataOnly: parsed.data.privacyMetadataOnly ?? true,
  });
  return NextResponse.json({ state });
}
