"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function RepoScannerPage() {
  const [localPath, setLocalPath] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [err, setErr] = useState<string | null>(null);

  async function scanLocal() {
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const res = await fetch("/api/scan/repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: { type: "local", path: localPath } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      setResult(data);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function scanRemote() {
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const res = await fetch("/api/scan/repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: { type: "url", url: repoUrl } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      setResult(data);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  const typed = result as {
    risk?: { totalScore: number; label: string };
    treeSummary?: { fileCount: number; truncated: boolean };
    sessionId?: string;
  } | null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50">Repo Scanner</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Static analysis only — no install, build, or script execution. Remote clones land in an
          isolated analysis directory under the project.
        </p>
      </div>

      <Tabs defaultValue="local">
        <TabsList>
          <TabsTrigger value="local">Local path</TabsTrigger>
          <TabsTrigger value="remote">Git URL</TabsTrigger>
        </TabsList>
        <TabsContent value="local">
          <Card>
            <CardHeader>
              <CardTitle>Local repository</CardTitle>
              <CardDescription>
                Path must be inside an approved folder. Metadata and scripts are parsed, not executed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="lp">Repository root</Label>
                <Input
                  id="lp"
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                  placeholder="/Users/you/approved/repos/sample"
                />
              </div>
              {err && <p className="text-sm text-red-400">{err}</p>}
              <Button disabled={busy || !localPath} onClick={() => void scanLocal()}>
                {busy ? "Working…" : "Analyze"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="remote">
          <Card>
            <CardHeader>
              <CardTitle>Clone & analyze</CardTitle>
              <CardDescription>
                Uses shallow git clone. Review network policy before use.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="url">HTTPS Git URL</Label>
                <Input
                  id="url"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/org/repo.git"
                />
              </div>
              {err && <p className="text-sm text-red-400">{err}</p>}
              <Button disabled={busy || !repoUrl} onClick={() => void scanRemote()}>
                {busy ? "Cloning…" : "Clone & analyze"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {typed?.risk && (
        <Card>
          <CardHeader>
            <CardTitle>Results snapshot</CardTitle>
            <CardDescription>Heuristic risk model — not a verdict of maliciousness</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Badge variant="warn">Score {typed.risk.totalScore}</Badge>
            <Badge>{typed.risk.label.replace(/_/g, " ")}</Badge>
            {typed.treeSummary && (
              <span className="text-sm text-zinc-400">
                Files walked: {typed.treeSummary.fileCount}
                {typed.treeSummary.truncated ? " (truncated)" : ""}
              </span>
            )}
            {typed.sessionId && (
              <Button variant="secondary" asChild>
                <a href={`/findings?session=${typed.sessionId}`}>Open findings</a>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {result != null ? (
        <Card>
          <CardHeader>
            <CardTitle>Raw JSON</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-96 overflow-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-300">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
