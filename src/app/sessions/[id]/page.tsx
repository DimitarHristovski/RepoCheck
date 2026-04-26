import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionBundle } from "@/lib/store/repository";
import { runSecurityAgent } from "@/lib/securityAgent/engine";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

function buildAgentFilesFromFindings(
  findings: ReturnType<typeof getSessionBundle>["findings"]
): { path: string; content: string }[] {
  const byPath = new Map<string, string[]>();
  for (const f of findings) {
    const p = f.filePath?.trim();
    const block = `**${f.severity}** [${f.category}] ${f.title}\n${f.description}`;
    if (p) {
      const key = p.replace(/\\/g, "/");
      if (!byPath.has(key)) byPath.set(key, []);
      byPath.get(key)!.push(block);
    } else {
      if (!byPath.has("(no path)")) byPath.set("(no path)", []);
      byPath.get("(no path)")!.push(block);
    }
  }
  return [...byPath.entries()].slice(0, 48).map(([path, lines]) => ({
    path,
    content: lines.join("\n\n---\n\n"),
  }));
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bundle = getSessionBundle(id);
  if (!bundle.session) notFound();

  const agentFiles = buildAgentFilesFromFindings(bundle.findings);
  const agentReport =
    agentFiles.length > 0
      ? runSecurityAgent(agentFiles, { debug: false })
      : null;

  const latestRisk = bundle.riskScores[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">Session</h1>
          <p className="mt-1 font-mono text-xs text-zinc-500">{id}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge>{bundle.session.type}</Badge>
            <Badge variant="outline">{bundle.session.status}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href={`/api/sessions/${id}/export`} target="_blank" rel="noreferrer">
              Download Markdown
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/findings?session=${id}`}>Findings</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/actions?session=${id}`}>Actions</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/sessions">All sessions</Link>
          </Button>
        </div>
      </div>

      {latestRisk ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-zinc-100">Heuristic risk (stored)</CardTitle>
            <CardDescription>From static scorer — not a malware verdict</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-zinc-300">
            <p>
              Score <strong className="text-zinc-100">{latestRisk.totalScore}</strong> / 100 · label{" "}
              <code className="text-emerald-300/90">{latestRisk.label}</code> · confidence{" "}
              {latestRisk.confidence}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {agentReport ? (
        <Card className="border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base text-zinc-100">Deterministic agent verdict</CardTitle>
            <CardDescription>
              Rule-based pipeline on finding text per path — conservative caps for false positives
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  agentReport.summary.verdict === "LIKELY_MALICIOUS" ||
                  agentReport.summary.verdict === "CONFIRMED_MALICIOUS"
                    ? "danger"
                    : agentReport.summary.verdict === "NEEDS_REVIEW"
                      ? "warn"
                      : "outline"
                }
              >
                {agentReport.summary.verdict}
              </Badge>
              <span className="text-zinc-400">
                score {agentReport.summary.totalScore} · confidence {agentReport.summary.confidence}
              </span>
            </div>
            {agentReport.summary.capsApplied.length > 0 ? (
              <ul className="list-disc pl-5 text-xs text-amber-200/80">
                {agentReport.summary.capsApplied.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            ) : null}
            <p className="text-zinc-400">{agentReport.finalReasoning}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base text-zinc-100">Summary</CardTitle>
          <CardDescription>{bundle.findings.length} findings in this session</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-zinc-400">
          <p>
            Use <strong className="text-zinc-300">Findings</strong> for the full list and review toggles. Risk
            copilot on the dashboard uses the same store for chat context.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
