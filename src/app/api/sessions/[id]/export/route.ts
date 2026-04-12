import { NextResponse } from "next/server";
import { getSessionBundle } from "@/lib/store/repository";
import { buildSessionMarkdown } from "@/lib/sessions/sessionMarkdownExport";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const bundle = getSessionBundle(id);
  if (!bundle.session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const md = buildSessionMarkdown({
    sessionId: id,
    session: bundle.session,
    findings: bundle.findings,
    riskScores: bundle.riskScores,
  });

  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 12) || "session";
  return new NextResponse(md, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="repocheck-${safe}.md"`,
    },
  });
}
