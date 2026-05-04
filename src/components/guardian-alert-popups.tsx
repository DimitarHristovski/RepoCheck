"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type GuardianAlert = {
  id: string;
  source: string;
  createdAt: string;
  detail: Record<string, unknown>;
};

const STORAGE_KEY = "repocheck-guardian-last-alert-seen-at";

function toNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function GuardianAlertPopups() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<GuardianAlert[]>([]);
  const [since, setSince] = useState<string | null>(null);
  const [scanBusyAlertId, setScanBusyAlertId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setSince(saved);
      return;
    }
    const now = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, now);
    setSince(now);
  }, []);

  useEffect(() => {
    if (!since) return;
    let alive = true;
    const sinceCursor = since;

    async function poll() {
      try {
        const url = new URL("/api/guardian/alerts", window.location.origin);
        url.searchParams.set("since", sinceCursor);
        url.searchParams.set("limit", "5");
        const res = await fetch(url.toString(), { cache: "no-store" });
        const data = (await res.json()) as { ok: boolean; alerts?: GuardianAlert[] };
        if (!alive || !res.ok || !data.ok) return;
        const incoming = data.alerts ?? [];
        if (incoming.length > 0) {
          setAlerts((prev) => {
            const seen = new Set(prev.map((x) => x.id));
            const merged = [...prev];
            for (const row of incoming) {
              if (!seen.has(row.id)) merged.push(row);
            }
            return merged.slice(0, 5);
          });
          const newest = incoming
            .map((x) => x.createdAt)
            .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
          if (newest) {
            localStorage.setItem(STORAGE_KEY, newest);
            setSince(newest);
          }
        }
      } catch {
        // Quietly ignore transient polling errors.
      }
    }

    void poll();
    const id = window.setInterval(() => void poll(), 15_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [since]);

  const visibleAlerts = useMemo(
    () =>
      alerts
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 3),
    [alerts]
  );

  function dismiss(id: string) {
    setAlerts((prev) => prev.filter((x) => x.id !== id));
  }

  async function scanAndShowInCopilot(repoUrl: string, alertRowId: string) {
    const trimmed = repoUrl.trim();
    if (!trimmed) return;
    setScanBusyAlertId(alertRowId);
    try {
      const res = await fetch("/api/scan/repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: { type: "url", url: trimmed } }),
      });
      const data = (await res.json()) as { sessionId?: string; error?: unknown };
      if (!res.ok || !data.sessionId) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : "Scan failed — check repo URL and GitHub token in Settings.";
        window.alert(msg);
        return;
      }
      router.push(`/?copilotSession=${encodeURIComponent(data.sessionId)}`);
      router.refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    } finally {
      setScanBusyAlertId(null);
    }
  }

  if (visibleAlerts.length === 0) return null;

  return (
    <div className="fixed right-4 top-16 z-[130] flex w-[min(28rem,92vw)] flex-col gap-2">
      {visibleAlerts.map((a) => {
        const minSeverity = String(a.detail.minSeverity ?? "medium");
        const count = toNumber(a.detail.count, 0);
        const sessionId = String(a.detail.sessionId ?? "");
        return (
          <div
            key={a.id}
            className="rounded-xl border border-red-500/50 bg-zinc-950/95 p-3 shadow-xl shadow-red-900/25"
          >
            <p className="text-sm font-semibold text-zinc-50">Guardian alert: harmful signals detected</p>
            <p className="mt-1 text-xs text-zinc-200">
              Repo: <span className="text-zinc-50">{a.source}</span>
            </p>
            <p className="text-xs text-zinc-300">
              Findings at/above {minSeverity}: {count}
            </p>
            <p className="text-[11px] text-zinc-500">{new Date(a.createdAt).toLocaleString()}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                className="bg-emerald-600 text-white hover:bg-emerald-500"
                disabled={scanBusyAlertId !== null}
                onClick={() => void scanAndShowInCopilot(a.source, a.id)}
              >
                {scanBusyAlertId === a.id ? (
                  <>
                    <Loader2 className="mr-1 inline size-3.5 animate-spin" />
                    Scanning…
                  </>
                ) : (
                  "Scan & show in Risk Copilot"
                )}
              </Button>
              {sessionId ? (
                <Button type="button" variant="secondary" size="sm" asChild>
                  <Link href={`/?copilotSession=${encodeURIComponent(sessionId)}`}>Open last scan</Link>
                </Button>
              ) : null}
              <Button type="button" variant="ghost" size="sm" onClick={() => dismiss(a.id)}>
                Dismiss
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
