import Link from "next/link";
import { getDashboardData } from "@/lib/server/dashboardData";
import { DashboardResetPanel } from "@/components/dashboard-reset-panel";
import { DashboardGithubScan } from "@/components/dashboard-github-scan";
import { DashboardRiskChat } from "@/components/dashboard-risk-chat";
import { DashboardGuardianPanel } from "@/components/dashboard-guardian-panel";
import { formatFindingCategory } from "@/lib/dashboardRiskCopy";

export const dynamic = "force-dynamic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RiskTrendChart } from "@/components/risk-trend-chart";
import { ChevronDown, CircleHelp } from "lucide-react";

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

  const topFindings = data.flaggedFindings.slice(0, 6);
  return (
    <div className="space-y-4">
      <div className="grid items-start gap-4 xl:min-h-[calc(100vh-7rem)] xl:grid-cols-[1fr_3fr] xl:items-stretch">
        <aside className="sidebar-scroll space-y-4 rounded-2xl border border-zinc-800/80 bg-zinc-950/70 p-3 xl:sticky xl:top-20 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto xl:pr-2">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Start here</p>
            <p className="mt-1 text-xs text-zinc-400">
              1) Run a scan, 2) review risks, 3) ask Copilot what to check next.
            </p>
          </div>
          <DashboardGithubScan />
          <DashboardGuardianPanel />
          <Card>
            <CardHeader>
              <CardTitle className="text-zinc-100">Recent scans</CardTitle>
              <CardDescription>Latest completed checks</CardDescription>
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
                        <Link href={`/findings?session=${s.id}`}>Open</Link>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <details className="group rounded-xl border border-zinc-800 bg-zinc-950/40">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-zinc-200 marker:content-none">
              <ChevronDown className="size-4 transition group-open:rotate-180" />
              Risk trend
            </summary>
            <div className="border-t border-zinc-800 px-4 pb-4 pt-2">
              <RiskTrendChart data={trendPoints} />
            </div>
          </details>

          <Card>
            <CardHeader>
              <CardTitle className="text-zinc-100">Top findings</CardTitle>
              <CardDescription>Most important medium+ issues</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {topFindings.length === 0 ? (
                <p className="text-sm text-zinc-500">Nothing to review yet.</p>
              ) : (
                topFindings.map((f) => (
                  <Link
                    key={f.id}
                    href={`/findings?session=${f.sessionId}`}
                    className="block rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2 hover:bg-zinc-900/70"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant={severityVariant(f.severity)}>{f.severity}</Badge>
                      <span className="truncate text-xs text-zinc-400">{formatFindingCategory(f.category)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-zinc-200">{f.title}</p>
                    {f.filePath && (
                      <p className="mt-1 truncate text-xs text-zinc-500">{f.filePath}</p>
                    )}
                  </Link>
                ))
              )}
              <div className="pt-1">
                <Link href="/findings" className="text-xs text-emerald-400 hover:underline">
                  View all findings
                </Link>
              </div>
            </CardContent>
          </Card>

          <DashboardResetPanel />
        </aside>

        <section className="min-w-0 xl:h-full">
          <DashboardRiskChat
            key={notableCount}
            notableFindingCount={notableCount}
            copilotRiskPathHints={data.copilotRiskPathHints}
          />
        </section>
      </div>
      <Link
        href="/settings"
        aria-label="Help and settings"
        className="fixed bottom-5 right-5 z-50 inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/95 text-zinc-100 shadow-lg transition hover:bg-zinc-800"
      >
        <CircleHelp className="size-5" />
      </Link>
    </div>
  );
}
