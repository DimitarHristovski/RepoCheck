"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RiskExplanationCard,
  type LlmRiskExplanationView,
} from "@/components/risk-explanation-card";

type Finding = {
  id: string;
  sessionId: string;
  severity: string;
  title: string;
  description: string;
  reviewed: boolean;
  filePath: string | null;
};

export default function FindingsPage() {
  const search = useSearchParams();
  const sessionId = search.get("session") ?? "";
  const [findings, setFindings] = useState<Finding[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [llmFromSession, setLlmFromSession] = useState<{
    explanation?: LlmRiskExplanationView;
    error?: { reason: string; message: string } | null;
  } | null>(null);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (sessionId) p.set("sessionId", sessionId);
    if (filter !== "all") p.set("severity", filter);
    return p.toString();
  }, [sessionId, filter]);

  useEffect(() => {
    void fetch(`/api/findings${qs ? `?${qs}` : ""}`)
      .then((r) => r.json())
      .then((d) => setFindings(d.findings ?? []));
  }, [qs]);

  useEffect(() => {
    if (!sessionId) {
      setLlmFromSession(null);
      return;
    }
    void fetch(`/api/sessions/${sessionId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { session?: { metadataJson?: Record<string, unknown> | null } } | null) => {
        if (!d?.session?.metadataJson) {
          setLlmFromSession(null);
          return;
        }
        const m = d.session.metadataJson;
        const explanation = m.llmRiskExplanation as LlmRiskExplanationView | undefined;
        const meta = m.llmRiskExplanationMeta as
          | { reason: string; message: string }
          | null
          | undefined;
        if (!explanation && !meta) {
          setLlmFromSession(null);
          return;
        }
        setLlmFromSession({
          explanation,
          error: meta ?? null,
        });
      })
      .catch(() => setLlmFromSession(null));
  }, [sessionId]);

  async function markReviewed(id: string, reviewed: boolean) {
    await fetch(`/api/findings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewed }),
    });
    setFindings((prev) =>
      prev.map((f) => (f.id === id ? { ...f, reviewed } : f))
    );
  }

  const groupedByPath = useMemo(() => {
    const m = new Map<string, Finding[]>();
    for (const f of findings) {
      const key = f.filePath?.trim() || "(no path)";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(f);
    }
    return [...m.entries()].sort(([a], [b]) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
  }, [findings]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50">Findings Explorer</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Evidence-first list with manual review state. Use filters to narrow noise. Local scans, public GitHub ZIP
          scans, and dashboard uploads all persist findings here.
        </p>
        {!sessionId && (
          <p className="mt-2 text-xs text-zinc-500">
            Showing recent findings across sessions. Filter by session from{" "}
            <Link href="/" className="text-emerald-400 underline">
              Dashboard
            </Link>{" "}
            → Recent scans, or{" "}
            <Link href="/actions" className="text-emerald-400 underline">
              Action Center
            </Link>
            , or{" "}
            <Link href="/sessions" className="text-emerald-400 underline">
              Sessions
            </Link>
            .
          </p>
        )}
      </div>

      {sessionId && (llmFromSession?.explanation || llmFromSession?.error) ? (
        <RiskExplanationCard
          explanation={llmFromSession.explanation}
          error={llmFromSession.error ?? null}
        />
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(["all", "critical", "high", "medium", "low", "info"] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? "default" : "secondary"}
            onClick={() => setFilter(s)}
          >
            {s}
          </Button>
        ))}
      </div>

      <div className="space-y-8">
        {findings.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-zinc-500">
              No findings for this view.
            </CardContent>
          </Card>
        ) : (
          groupedByPath.map(([pathKey, list]) => (
            <section key={pathKey} className="space-y-3">
              <h2 className="border-b border-zinc-800 pb-1 font-mono text-xs font-medium tracking-tight text-zinc-400">
                {pathKey}
                <span className="ml-2 font-sans text-zinc-600">({list.length})</span>
              </h2>
              <div className="grid gap-3">
                {list.map((f) => (
                  <Card key={f.id}>
                    <CardHeader className="flex flex-row items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant={
                              f.severity === "high" || f.severity === "critical"
                                ? "danger"
                                : f.severity === "medium"
                                  ? "warn"
                                  : "default"
                            }
                          >
                            {f.severity}
                          </Badge>
                          {f.reviewed && <Badge variant="success">Reviewed</Badge>}
                          <CardTitle className="text-base text-zinc-100">{f.title}</CardTitle>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void markReviewed(f.id, !f.reviewed)}
                      >
                        {f.reviewed ? "Unmark" : "Mark reviewed"}
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-zinc-300">{f.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
