import Link from "next/link";
import { getDashboardData } from "@/lib/server/dashboardData";
import { DashboardGithubScan } from "@/components/dashboard-github-scan";
import { DashboardRiskChat } from "@/components/dashboard-risk-chat";

export const dynamic = "force-dynamic";
import { RiskTrendChart } from "@/components/risk-trend-chart";
import { ChevronDown, CircleHelp } from "lucide-react";

type DashboardPageProps = {
  searchParams?: Promise<{ copilotSession?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const sp = searchParams ? await searchParams : {};
  const copilotFocusSessionId = sp.copilotSession?.trim() || null;

  const data = getDashboardData();
  const trendPoints = data.riskTrend.map((r) => ({
    id: r.id,
    score: r.totalScore,
    label: r.label,
  }));
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

          <details className="group rounded-xl border border-zinc-800 bg-zinc-950/40">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-zinc-200 marker:content-none">
              <ChevronDown className="size-4 transition group-open:rotate-180" />
              Risk trend
            </summary>
            <div className="border-t border-zinc-800 px-4 pb-4 pt-2">
              <RiskTrendChart data={trendPoints} />
            </div>
          </details>
        </aside>

        <section className="min-w-0 xl:h-full">
          <DashboardRiskChat
            copilotRiskPathHints={data.copilotRiskPathHints}
            copilotFocusSessionId={copilotFocusSessionId}
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
