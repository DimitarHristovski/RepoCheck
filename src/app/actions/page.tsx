"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

type SessionRow = {
  id: string;
  type: string;
  status: string;
  createdAt: string;
};

export default function ActionCenterPage() {
  const search = useSearchParams();
  const sessionFilter = search.get("session") ?? "";
  const [actions, setActions] = useState<Proposed[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  useEffect(() => {
    if (!sessionFilter) {
      setActions([]);
      return;
    }
    void fetch(`/api/sessions/${sessionFilter}`)
      .then((r) => r.json())
      .then((d) => setActions(d.proposedActions ?? []));
  }, [sessionFilter]);

  useEffect(() => {
    if (sessionFilter) {
      setSessions([]);
      return;
    }
    void fetch("/api/sessions")
      .then((r) => r.json())
      .then((d: { sessions?: SessionRow[] }) => {
        const list = d.sessions ?? [];
        setSessions(
          list.filter((s) => s.type === "repo" || s.type === "upload")
        );
      });
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
          Approve or reject proposed steps recorded with each scan. v0.1 records intent; filesystem moves can be wired
          with explicit confirmation later.
        </p>
      </div>

      {!sessionFilter && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-zinc-100">Pick a session</CardTitle>
            <CardDescription>
              Repo and upload scans each create a <strong className="text-zinc-500">manual_review</strong> action.
              Open one below, or use <strong className="text-zinc-500">?session=…</strong> in the URL.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {sessions.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No repo or upload sessions yet. Run <Link href="/" className="text-emerald-400 underline">Scan GitHub repo</Link>{" "}
                or attach files in Risk copilot on the dashboard.
              </p>
            ) : (
              <ul className="space-y-2">
                {sessions.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2"
                  >
                    <div>
                      <span className="text-sm capitalize text-zinc-200">
                        {s.type} · {s.status}
                      </span>
                      <p className="font-mono text-xs text-zinc-500">{s.id.slice(0, 8)}…</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" asChild>
                        <Link href={`/sessions/${s.id}`}>Session</Link>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/actions?session=${s.id}`}>Actions</Link>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/findings?session=${s.id}`}>Findings</Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {sessionFilter && actions.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-zinc-500">
            No proposed actions for this session (or session not found).
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
