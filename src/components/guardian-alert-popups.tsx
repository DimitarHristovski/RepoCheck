"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Bell, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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

export function HeaderGuardianAlerts() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [alerts, setAlerts] = useState<GuardianAlert[]>([]);
  const [since, setSince] = useState<string | null>(null);
  const [scanBusyAlertId, setScanBusyAlertId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

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
        url.searchParams.set("limit", "15");
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
            return merged.slice(0, 15);
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

  const sortedAlerts = useMemo(
    () =>
      alerts
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [alerts]
  );

  const badgeCount = sortedAlerts.length;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointerDown(e: PointerEvent) {
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

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
      setOpen(false);
      router.push(`/?copilotSession=${encodeURIComponent(data.sessionId)}`);
      router.refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    } finally {
      setScanBusyAlertId(null);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          "relative h-9 gap-1.5 px-2 text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-50",
          open && "bg-zinc-800/60 text-zinc-50"
        )}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={badgeCount ? `Guardian alerts, ${badgeCount} harmful` : "Guardian alerts"}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="size-4 shrink-0" aria-hidden />
        <span className="hidden text-xs sm:inline">Alerts</span>
        {badgeCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div
          className="absolute right-0 z-50 mt-1.5 w-[min(22rem,calc(100vw-2rem))] max-h-[min(70vh,32rem)] overflow-y-auto rounded-xl border border-zinc-700/90 bg-zinc-950/98 p-2 shadow-2xl shadow-black/40 backdrop-blur-md"
          role="dialog"
          aria-label="Guardian harmful repository alerts"
        >
          {sortedAlerts.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-zinc-500">
              No harmful-repo alerts yet. When Guardian flags a connected repo, it will appear here.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {sortedAlerts.map((a) => {
                const minSeverity = String(a.detail.minSeverity ?? "medium");
                const count = toNumber(a.detail.count, 0);
                const sessionId = String(a.detail.sessionId ?? "");
                return (
                  <li
                    key={a.id}
                    className="rounded-lg border border-red-500/40 bg-zinc-900/80 p-3 shadow-inner"
                  >
                    <p className="text-sm font-semibold text-zinc-50">Harmful signals</p>
                    <p className="mt-1 text-xs text-zinc-200">
                      Repo: <span className="text-zinc-50">{a.source}</span>
                    </p>
                    <p className="text-xs text-zinc-400">
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
                          <Link href={`/?copilotSession=${encodeURIComponent(sessionId)}`}>
                            Open last scan
                          </Link>
                        </Button>
                      ) : null}
                      <Button type="button" variant="ghost" size="sm" onClick={() => dismiss(a.id)}>
                        Dismiss
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
