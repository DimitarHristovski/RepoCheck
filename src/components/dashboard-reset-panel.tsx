"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function DashboardResetPanel() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function reset(scope: "scans" | "all") {
    const ok = window.confirm(
      scope === "all"
        ? "Clear all scan history, findings, and clone records from this machine? (Also clears legacy folder entries from the store file.)"
        : "Remove all repo scan sessions, findings, and scores from the local store?"
    );
    if (!ok) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/store/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: scope === "all" ? "all" : "scans" }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: unknown };
        throw new Error(typeof d.error === "string" ? d.error : "Request failed");
      }
      setMsg("Done — refreshing…");
      router.refresh();
      setMsg("Done.");
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-zinc-800">
      <CardHeader>
        <CardTitle className="text-zinc-100">Dashboard data on this device</CardTitle>
        <CardDescription>
          Data lives in <code className="text-zinc-500">data/repocheck-store.json</code>. Reset updates the file and
          refreshes this page.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => void reset("scans")}
        >
          Clear scans &amp; findings
        </Button>
        <Button
          type="button"
          variant="outline"
          className="border-red-900/60 text-red-200 hover:bg-red-950/40"
          disabled={busy}
          onClick={() => void reset("all")}
        >
          Reset everything in store
        </Button>
        <Link
          href="/settings"
          className="inline-flex items-center text-sm text-zinc-500 underline-offset-4 hover:text-zinc-300 hover:underline"
        >
          Settings
        </Link>
        {msg && <p className="w-full text-sm text-zinc-400">{msg}</p>}
      </CardContent>
    </Card>
  );
}
