"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Proposed = {
  id: string;
  actionType: string;
  status: string;
  payloadJson: Record<string, unknown>;
};

export default function ActionCenterPage() {
  const search = useSearchParams();
  const sessionFilter = search.get("session") ?? "";
  const [actions, setActions] = useState<Proposed[]>([]);

  useEffect(() => {
    if (!sessionFilter) {
      setActions([]);
      return;
    }
    void fetch(`/api/sessions/${sessionFilter}`)
      .then((r) => r.json())
      .then((d) => setActions(d.proposedActions ?? []));
  }, [sessionFilter]);

  async function approve(id: string) {
    await fetch(`/api/actions/${id}/approve`, { method: "POST" });
    setActions((a) => a.map((x) => (x.id === id ? { ...x, status: "approved" } : x)));
  }

  async function reject(id: string) {
    await fetch(`/api/actions/${id}/reject`, { method: "POST" });
    setActions((a) => a.map((x) => (x.id === id ? { ...x, status: "rejected" } : x)));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50">Action Center</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Approve or reject proposed organization steps. v0.1 records intent; filesystem moves can be
          wired with explicit confirmation in a later iteration.
        </p>
      </div>

      {!sessionFilter && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-zinc-500">
            Open from the dashboard with a session link, or append <code className="text-zinc-400">?session=…</code>{" "}
            to the URL.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {actions.map((a) => (
          <Card key={a.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{a.actionType}</Badge>
                  <Badge variant="outline">{a.status}</Badge>
                </div>
                <CardTitle className="mt-2 text-base text-zinc-100">
                  {(a.payloadJson.description as string) ?? "Organization proposal"}
                </CardTitle>
                <CardDescription className="font-mono text-xs text-zinc-500">
                  {a.id}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => void approve(a.id)}>
                  Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => void reject(a.id)}>
                  Reject
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="max-h-48 overflow-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-400">
                {JSON.stringify(a.payloadJson, null, 2)}
              </pre>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
