"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function HeaderDataTools() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function clearHistoryAndData() {
    const ok = window.confirm(
      "Clear all local scan history and data on this machine?\n\n" +
        "This removes sessions, findings, risk scores, downloaded archive records, audit logs, and legacy folder entries from the store. " +
        "Saved Settings (including Guardian token) are not removed.\n\n" +
        "This cannot be undone."
    );
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch("/api/store/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "all" }),
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
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-red-900/60 text-red-200 hover:bg-red-950/40"
        disabled={busy}
        onClick={() => void clearHistoryAndData()}
      >
        {busy ? "Clearing…" : "Clear history & data"}
      </Button>
    </div>
  );
}
