"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50">Findings Explorer</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Evidence-first list with manual review state. Use filters to narrow noise.
        </p>
      </div>

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

      <div className="grid gap-4">
        {findings.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-zinc-500">
              No findings for this view.
            </CardContent>
          </Card>
        ) : (
          findings.map((f) => (
            <Card key={f.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={f.severity === "high" || f.severity === "critical" ? "danger" : "default"}>
                      {f.severity}
                    </Badge>
                    {f.reviewed && <Badge variant="success">Reviewed</Badge>}
                    <CardTitle className="text-base text-zinc-100">{f.title}</CardTitle>
                  </div>
                  <CardDescription className="mt-2 text-zinc-400">
                    {f.filePath && <span className="font-mono text-xs">{f.filePath}</span>}
                  </CardDescription>
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
          ))
        )}
      </div>
    </div>
  );
}
