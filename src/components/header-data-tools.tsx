"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function HeaderDataTools() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function reset(scope: "scans" | "all") {
    const ok = window.confirm(
      scope === "all"
        ? "Clear all scan history, findings, and downloaded GitHub archives from this machine? (Also clears legacy folder entries from the store file.)"
        : "Remove all repo scan sessions, findings, and scores from the local store?"
    );
    if (!ok) return;

    setBusy(true);
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
      router.refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ml-auto flex items-center gap-2">
      <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void reset("scans")}>
        Clear history
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-red-900/60 text-red-200 hover:bg-red-950/40"
        disabled={busy}
        onClick={() => void reset("all")}
      >
        Reset all data
      </Button>
    </div>
  );
}
