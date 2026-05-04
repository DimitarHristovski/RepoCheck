"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type GuardianStatus = {
  started: boolean;
  enabled: boolean;
  githubRepoCount: number;
  watchedDirs: number;
  pollMs: number;
  runningGithubJobs: number;
  runningLocalJobs: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastRunDurationMs: number | null;
  nextRunAt: string | null;
};

export function DashboardGuardianPanel() {
  const [status, setStatus] = useState<GuardianStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/guardian/status");
    const data = (await res.json()) as GuardianStatus;
    setStatus(data);
  }

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 10000);
    return () => clearInterval(t);
  }, []);

  async function runNow() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/guardian/run-now", { method: "POST" });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Run failed");
      setMsg("Guardian run completed.");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-zinc-800/80 bg-zinc-950/60">
      <CardHeader>
        <CardTitle className="text-zinc-100">Auto monitor (Guardian)</CardTitle>
        <CardDescription>
          Each connected GitHub repo is scanned automatically on every poll cycle (plus optional local folders).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-xs text-zinc-300">
        {status ? (
          <>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Current state</p>
              <p className="mt-1">
                {status.started ? "Running" : "Stopped"} · enabled={String(status.enabled)}
              </p>
              <p>
                Connected repos: {status.githubRepoCount} (each scanned automatically each cycle)
              </p>
              <p>Watched folders: {status.watchedDirs}</p>
              <p>
                Active jobs (GitHub/local): {status.runningGithubJobs}/{status.runningLocalJobs}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Schedule</p>
              <p className="mt-1">Poll interval: {status.pollMs} ms</p>
              <p>Last run: {status.lastRunAt ?? "n/a"}</p>
              <p>Last success: {status.lastSuccessAt ?? "n/a"}</p>
              <p>Next run: {status.nextRunAt ?? "n/a"}</p>
              {status.lastRunDurationMs != null && <p>Last duration: {status.lastRunDurationMs} ms</p>}
              {status.lastError && <p className="text-red-300">Last error: {status.lastError}</p>}
            </div>
          </>
        ) : (
          <p className="text-zinc-500">Loading status…</p>
        )}
        <div className="pt-1">
          <Button className="w-full" size="sm" disabled={busy} onClick={() => void runNow()}>
            {busy ? "Running…" : "Scan all now"}
          </Button>
        </div>
        {msg && <p className="text-zinc-400">{msg}</p>}
      </CardContent>
    </Card>
  );
}

