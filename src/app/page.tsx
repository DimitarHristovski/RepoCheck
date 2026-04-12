import Link from "next/link";
import { getDashboardData } from "@/lib/server/dashboardData";
import { DashboardResetPanel } from "@/components/dashboard-reset-panel";
import { DashboardGithubScan } from "@/components/dashboard-github-scan";
import { DashboardRiskChat } from "@/components/dashboard-risk-chat";
import {
  formatFindingCategory,
  impactPlainLanguage,
} from "@/lib/dashboardRiskCopy";

export const dynamic = "force-dynamic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RiskTrendChart } from "@/components/risk-trend-chart";
import { ChevronDown } from "lucide-react";

function severityVariant(s: string): "info" | "warn" | "danger" | "default" {
  if (s === "critical" || s === "high") return "danger";
  if (s === "medium") return "warn";
  if (s === "low") return "info";
  return "default";
}

export default function DashboardPage() {
  const data = getDashboardData();
  const trendPoints = data.riskTrend.map((r) => ({
    id: r.id,
    score: r.totalScore,
    label: r.label,
  }));
  const notableCount = data.flaggedFindings.length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">
            Dashboard
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            Clone any <strong className="font-medium text-zinc-300">GitHub</strong> repo from here,
            or <strong className="font-medium text-zinc-300">attach zips / source files</strong> in Risk copilot (saved
            as upload sessions with findings). The copilot merges store scans with attachment context — metadata and
            short descriptions, not full repos unless quoted.
          </p>
        </div>
      </div>

      <DashboardGithubScan />

      <DashboardRiskChat
        key={notableCount}
        notableFindingCount={notableCount}
        copilotRiskPathHints={data.copilotRiskPathHints}
      />

      <details className="group rounded-xl border border-zinc-800 bg-zinc-950/40">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-zinc-200 marker:content-none">
          <ChevronDown className="size-4 transition group-open:rotate-180" />
          Charts &amp; numbers
        </summary>
        <div className="border-t border-zinc-800 space-y-4 px-4 pb-4 pt-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-zinc-100">Scan risk trend</CardTitle>
              <CardDescription>
                Each point is one completed repo or upload scan. The line shows how the{" "}
                <strong className="font-medium text-zinc-400">heuristic risk score (0–100)</strong> moves over your
                most recent scans — useful to spot a sudden jump after a dependency or script change. It is{" "}
                <strong className="font-medium text-zinc-400">not</strong> a malware guarantee; low scores can still
                miss issues, and high scores can include false positives.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RiskTrendChart data={trendPoints} />
            </CardContent>
          </Card>

          <div
            className="rounded-xl border border-red-900/55 bg-red-950/25 px-4 py-4 text-sm leading-relaxed text-red-100/95"
            role="note"
            aria-label="How harmful code can affect your data"
          >
            <p className="font-semibold tracking-tight text-red-200">
              If malicious or abused code actually runs on your machine (install scripts, running the app, pip/npm
              install), patterns we flag can correlate with real harm to your data:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-red-100/90 marker:text-red-400/80">
              <li>
                <span className="font-medium text-red-200">Secrets and credentials</span> — code that reads{" "}
                <code className="rounded bg-red-950/80 px-1 text-xs text-red-100/90">.env</code>, API keys, or tokens
                and sends them over the network can lead to account takeover and data exfiltration.
              </li>
              <li>
                <span className="font-medium text-red-200">Local files</span> — filesystem access can copy SSH keys,
                browser profiles, documents, or project data to an attacker.
              </li>
              <li>
                <span className="font-medium text-red-200">Supply-chain installs</span> —{" "}
                <code className="rounded bg-red-950/80 px-1 text-xs text-red-100/90">postinstall</code> / shell chains
                can run the moment you install dependencies, before you read the source.
              </li>
              <li>
                <span className="font-medium text-red-200">RepoCheck’s own scope</span> — this app performs{" "}
                <strong className="text-red-200">static analysis only</strong> here. It does not execute your scanned
                repo. Risk rises when <strong className="text-red-200">you</strong> run, build, or install that code on
                a machine that holds sensitive data.
              </li>
            </ul>
          </div>
        </div>
      </details>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-zinc-100">Recent scans</CardTitle>
            <CardDescription>Latest repo and upload sessions from the local JSON store</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentSessions.length === 0 ? (
              <p className="text-sm text-zinc-500">No scans yet.</p>
            ) : (
              data.recentSessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium capitalize text-zinc-200">
                      {s.type} · {s.status}
                    </p>
                    <p className="text-xs text-zinc-500">{s.id.slice(0, 8)}…</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/findings?session=${s.id}`}>Findings</Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/actions?session=${s.id}`}>Actions</Link>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <details className="group rounded-xl border border-zinc-800 bg-zinc-900/30 open:bg-zinc-900/50">
          <summary className="cursor-pointer list-none px-6 py-4 marker:content-none">
            <CardTitle className="text-base text-zinc-100">Structured finding list</CardTitle>
            <CardDescription className="mt-1">
              Same signals as in the copilot context — medium+ severities from repo and upload scans, with paths and
              static explanations.
            </CardDescription>
          </summary>
          <div className="space-y-4 border-t border-zinc-800 px-6 pb-6 pt-2">
            {data.flaggedFindings.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Nothing to list yet. Run a scan first.
              </p>
            ) : (
              data.flaggedFindings.map((f) => (
                <div
                  key={f.id}
                  className="space-y-2 rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-3 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={severityVariant(f.severity)}>{f.severity}</Badge>
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      {formatFindingCategory(f.category)}
                    </span>
                  </div>
                  <p className="font-medium leading-snug text-zinc-100">{f.title}</p>
                  <div className="space-y-1 text-xs">
                    <p>
                      <span className="font-medium text-zinc-400">File: </span>
                      {f.filePath ? (
                        <code className="break-all rounded bg-zinc-950 px-1.5 py-0.5 text-[0.8rem] text-emerald-200/90">
                          {f.filePath}
                        </code>
                      ) : (
                        <span className="italic text-zinc-500">
                          Not tied to one file (scan-wide or path-only signal)
                        </span>
                      )}
                      {f.lineHint ? (
                        <span className="ml-1 text-zinc-500">· {f.lineHint}</span>
                      ) : null}
                    </p>
                    <p className="text-zinc-300">
                      <span className="font-medium text-zinc-400">What the scanner saw: </span>
                      {f.description}
                    </p>
                    <p className="text-zinc-400">
                      <span className="font-medium text-zinc-500">If this were harmful: </span>
                      {impactPlainLanguage(f.category)}
                    </p>
                  </div>
                  <div className="pt-1">
                    <Link
                      href={`/findings?session=${f.sessionId}`}
                      className="text-xs text-emerald-400 hover:underline"
                    >
                      Open findings for this scan
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </details>
      </div>

      <DashboardResetPanel />
    </div>
  );
}
