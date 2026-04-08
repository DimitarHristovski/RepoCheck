import Link from "next/link";
import { getDashboardData } from "@/lib/server/dashboardData";

export const dynamic = "force-dynamic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RiskTrendChart } from "@/components/risk-trend-chart";
import { ShieldCheck, FolderSearch, GitBranch } from "lucide-react";

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

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">
            Dashboard
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            Local-first posture overview. Scans never leave approved folders unless you
            enable LLM features and consent to sharing structured findings.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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

        <Card>
          <CardHeader>
            <CardTitle className="text-zinc-100">Flagged items</CardTitle>
            <CardDescription>High / critical static findings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.flaggedFindings.length === 0 ? (
              <p className="text-sm text-zinc-500">Nothing flagged yet.</p>
            ) : (
              data.flaggedFindings.map((f) => (
                <div
                  key={f.id}
                  className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant={severityVariant(f.severity)}>{f.severity}</Badge>
                    <span className="text-sm font-medium text-zinc-200">{f.title}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                    {f.description}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
