import Link from "next/link";
import { getDashboardData } from "@/lib/server/dashboardData";
import { DashboardResetPanel } from "@/components/dashboard-reset-panel";
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
import { ShieldCheck, FolderSearch, GitBranch, ChevronDown } from "lucide-react";

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
            The <strong className="font-medium text-zinc-300">Risk copilot</strong> below answers like a chat: ask
            about suspicious files, what patterns might mean, and what to verify. It only sees scanner metadata from
            your local store — not full source unless a finding quotes a fragment.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href="/folder-scanner">
              <FolderSearch className="size-4" />
              Folder scan
            </Link>
          </Button>
          <Button asChild>
            <Link href="/repo-scanner">
              <GitBranch className="size-4" />
              Repo scan
            </Link>
          </Button>
        </div>
      </div>

      <DashboardRiskChat key={notableCount} notableFindingCount={notableCount} />

      <details className="group rounded-xl border border-zinc-800 bg-zinc-950/40">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-zinc-200 marker:content-none">
          <ChevronDown className="size-4 transition group-open:rotate-180" />
          Charts &amp; numbers
        </summary>
        <div className="border-t border-zinc-800 px-4 pb-4 pt-2">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-zinc-300">
                  Approved folders
                </CardTitle>
                <ShieldCheck className="size-4 text-emerald-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-zinc-50">
                  {data.approvedFolderCount}
                </div>
                <p className="text-xs text-zinc-500">
                  Only these roots can be inventoried or host local repos.
                </p>
              </CardContent>
            </Card>
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-zinc-100">Risk trend</CardTitle>
                <CardDescription>Recent scan scores (0–100, heuristic)</CardDescription>
              </CardHeader>
              <CardContent>
                <RiskTrendChart data={trendPoints} />
              </CardContent>
            </Card>
          </div>
        </div>
      </details>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-zinc-100">Recent scans</CardTitle>
            <CardDescription>Latest sessions from the local JSON store</CardDescription>
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
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/actions?session=${s.id}`}>Open</Link>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <details className="group rounded-xl border border-zinc-800 bg-zinc-900/30 open:bg-zinc-900/50">
          <summary className="cursor-pointer list-none px-6 py-4 marker:content-none">
            <CardTitle className="text-base text-zinc-100">Structured finding list</CardTitle>
            <CardDescription className="mt-1">
              Same signals as in the copilot context — medium+ severities, with file paths and static explanations.
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
