"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RiskExplanationCard,
  type LlmRiskExplanationView,
} from "@/components/risk-explanation-card";

type Folder = { id: string; path: string; label: string | null };

export default function RepoScannerPage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [approvedId, setApprovedId] = useState("");
  const [relativePath, setRelativePath] = useState("");
  const [fullPath, setFullPath] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadFolders = useCallback(() => {
    void fetch("/api/folders")
      .then((r) => r.json())
      .then((d: { folders?: Folder[] }) => {
        const list = d.folders ?? [];
        setFolders(list);
        setApprovedId((id) =>
          id && list.some((f) => f.id === id) ? id : ""
        );
      })
      .catch(() => setErr("Could not load approved folders"));
  }, []);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    setRelativePath("");
    setFullPath("");
    setRepoUrl("");
    setResult(null);
    setErr(null);
  }, []);

  function resetForm() {
    setApprovedId("");
    setRelativePath("");
    setFullPath("");
    setRepoUrl("");
    setResult(null);
    setErr(null);
  }

  async function scanFromApproved() {
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      if (!approvedId) {
        throw new Error("Add an approved folder on the Folder Scanner page first.");
      }
      const res = await fetch("/api/scan/repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: {
            type: "local",
            approvedFolderId: approvedId,
            relativePath: relativePath.trim() || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      }
      setResult(data);
      setRelativePath("");
      setApprovedId("");
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function scanFullPath() {
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const res = await fetch("/api/scan/repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: { type: "local", path: fullPath.trim() } }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      }
      setResult(data);
      setFullPath("");
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
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      }
      setResult(data);
      setRepoUrl("");
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
    llmRiskExplanation?: LlmRiskExplanationView;
    llmRiskExplanationError?: { reason: string; message: string };
  } | null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50">Repo Scanner</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Static analysis only — no install, build, or script execution. For local repos, pick an approved
          folder and optionally a subfolder, or paste a full path that stays inside an approved root. Remote
          clones use an isolated directory under the project.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-zinc-500">
          Inputs are not kept after you leave this page. Use Clear form to reset fields.
        </p>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={resetForm}>
          Clear form
        </Button>
      </div>

      <Tabs defaultValue="approved">
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="approved">From approved folder</TabsTrigger>
          <TabsTrigger value="path">Full path</TabsTrigger>
          <TabsTrigger value="remote">Git URL</TabsTrigger>
        </TabsList>

        <TabsContent value="approved">
          <Card>
            <CardHeader>
              <CardTitle>Repo inside an approved folder</CardTitle>
              <CardDescription>
                Choose the same approved root you use for documents/projects, then the folder that contains
                the repository (leave empty to scan the approved root itself).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {folders.length === 0 ? (
                <p className="text-sm text-amber-200/90">
                  No approved folders yet.{" "}
                  <Link href="/folder-scanner" className="text-emerald-400 underline">
                    Add one on Folder Scanner
                  </Link>{" "}
                  first.
                </p>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="ap">Approved folder</Label>
                    <select
                      id="ap"
                      className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
                      value={approvedId}
                      onChange={(e) => setApprovedId(e.target.value)}
                    >
                      <option value="">Select an approved folder…</option>
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.path}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rel">Path inside it (optional)</Label>
                    <Input
                      id="rel"
                      name="repocheck-rel"
                      autoComplete="off"
                      value={relativePath}
                      onChange={(e) => setRelativePath(e.target.value)}
                      placeholder="my-repo or projects/web (leave empty for root)"
                    />
                  </div>
                </>
              )}
              {err && <p className="text-sm text-red-400">{err}</p>}
              <Button
                disabled={busy || folders.length === 0 || !approvedId}
                onClick={() => void scanFromApproved()}
              >
                {busy ? "Analyzing…" : "Analyze repository"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="path">
          <Card>
            <CardHeader>
              <CardTitle>Full path to repository root</CardTitle>
              <CardDescription>
                Must still lie inside an approved folder. Same as choosing an approved folder with no
                subpath.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fp">Absolute path</Label>
                <Input
                  id="fp"
                  name="repocheck-fullpath"
                  autoComplete="off"
                  value={fullPath}
                  onChange={(e) => setFullPath(e.target.value)}
                  placeholder="/Users/you/Documents/repos/my-app"
                />
              </div>
              {err && <p className="text-sm text-red-400">{err}</p>}
              <Button disabled={busy || !fullPath.trim()} onClick={() => void scanFullPath()}>
                {busy ? "Analyzing…" : "Analyze"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="remote">
          <Card>
            <CardHeader>
              <CardTitle>Clone & analyze</CardTitle>
              <CardDescription>Shallow git clone. No approved folder required for the URL flow.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="url">HTTPS Git URL</Label>
                <Input
                  id="url"
                  name="repocheck-git-url"
                  autoComplete="off"
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
                <Link href={`/findings?session=${typed.sessionId}`}>Open findings</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {(typed?.llmRiskExplanation || typed?.llmRiskExplanationError) && (
        <RiskExplanationCard
          explanation={typed.llmRiskExplanation}
          error={typed.llmRiskExplanationError ?? null}
        />
      )}

      {result != null ? (
        <details className="rounded-lg border border-zinc-800 bg-zinc-950/50">
          <summary className="cursor-pointer px-3 py-2 text-sm text-zinc-400">
            Technical JSON (optional)
          </summary>
          <pre className="max-h-96 overflow-auto border-t border-zinc-800 p-3 text-xs text-zinc-300">
            {JSON.stringify(result, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
