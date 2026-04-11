"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FolderOpen } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  RiskExplanationCard,
  type LlmRiskExplanationView,
} from "@/components/risk-explanation-card";

type Folder = { id: string; path: string; label: string | null };

type ScanResult = {
  sessionId?: string;
  stats?: {
    fileCount: number;
    findingsCount: number;
    plannedActions: number;
    categoryCounts?: Record<string, number>;
  };
  risk?: { totalScore: number; label: string };
  errors?: string[];
  llmRiskExplanation?: LlmRiskExplanationView;
  llmRiskExplanationError?: { reason: string; message: string };
};

export default function FolderScannerPage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [pathInput, setPathInput] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [pickBusy, setPickBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const loadFolders = useCallback(() => {
    void fetch("/api/folders")
      .then((r) => r.json())
      .then((d: { folders?: Folder[] }) => {
        const list = d.folders ?? [];
        setFolders(list);
        setSelectedId((prev) =>
          prev && list.some((f) => f.id === prev) ? prev : ""
        );
      })
      .catch(() => setErr("Could not load folders"));
  }, []);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    setPathInput("");
    setResult(null);
    setInfo(null);
    setErr(null);
  }, []);

  function resetForm() {
    setPathInput("");
    setSelectedId("");
    setResult(null);
    setInfo(null);
    setErr(null);
  }

  async function pickFolderNative() {
    setErr(null);
    setInfo(null);
    setPickBusy(true);
    try {
      const res = await fetch("/api/folders/pick", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        if (data.cancelled) {
          setInfo("Selection cancelled.");
          return;
        }
        setErr(typeof data.error === "string" ? data.error : "Could not pick folder");
        return;
      }
      if (data.folder) {
        setFolders((f) => [...f.filter((x) => x.id !== data.folder.id), data.folder]);
        setSelectedId(data.folder.id);
        setInfo(`Approved: ${data.folder.path}`);
      }
      loadFolders();
    } catch (e) {
      setErr(String(e));
    } finally {
      setPickBusy(false);
    }
  }

  async function addFolder() {
    setErr(null);
    setInfo(null);
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathInput }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(
        typeof data.error === "string"
          ? data.error
          : JSON.stringify(data.error ?? "Failed")
      );
      return;
    }
    if (data.folder) {
      setFolders((f) => [...f.filter((x) => x.id !== data.folder.id), data.folder]);
      setSelectedId(data.folder.id);
      setPathInput("");
      setInfo(`Approved: ${data.folder.path}`);
    }
    loadFolders();
  }

  async function runScan() {
    if (!selectedId) {
      setErr("Select an approved folder first.");
      return;
    }
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const res = await fetch("/api/scan/folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvedFolderId: selectedId }),
      });
      const data = (await res.json()) as ScanResult & { error?: unknown };
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : JSON.stringify(data.error ?? res.statusText)
        );
      }
      setResult(data);
      setInfo(null);
      setPathInput("");
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  const categoryLabels: Record<string, string> = {
    documents: "Documents",
    images: "Images",
    archives: "Archives",
    code: "Code",
    scripts: "Scripts",
    installers: "Installers",
    unknown: "Other / unknown",
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50">Folder Scanner</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Approve a folder first, select it, then scan. Use <strong className="text-zinc-300">Choose folder</strong>{" "}
          (macOS / Windows / Linux with zenity) or type a path — <code className="text-zinc-500">~/Documents</code> works.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Path and scan summary here are not kept when you leave this page. Clear persisted folders and scan history
          from{" "}
          <Link href="/settings" className="text-emerald-400 hover:underline">
            Settings → Local data
          </Link>
          .
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Approved folders</CardTitle>
          <CardDescription>
            RepoCheck only reads inside folders you approve. The server runs on your machine so it can open a system
            folder dialog.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              disabled={pickBusy}
              onClick={() => void pickFolderNative()}
            >
              <FolderOpen className="size-4" />
              {pickBusy ? "Opening…" : "Choose folder…"}
            </Button>
            <span className="hidden text-zinc-600 sm:inline">or</span>
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="path">Path</Label>
                <Input
                  id="path"
                  name="repocheck-path"
                  autoComplete="off"
                  placeholder="~/Documents or /Users/you/Documents"
                  value={pathInput}
                  onChange={(e) => setPathInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void addFolder();
                  }}
                />
              </div>
              <Button type="button" onClick={() => void addFolder()} disabled={!pathInput.trim()}>
                Approve path
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="target">2. Folder to scan</Label>
            {folders.length === 0 ? (
              <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-200/90">
                No folders yet — use <strong>Choose folder</strong> or type a path and click <strong>Approve path</strong>.
              </p>
            ) : (
              <select
                id="target"
                className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                <option value="">Select a folder…</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label ? `${f.label} — ${f.path}` : f.path}
                  </option>
                ))}
              </select>
            )}
          </div>
          {info && <p className="text-sm text-emerald-400/90">{info}</p>}
          {err && <p className="text-sm text-red-400">{err}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Run inventory</CardTitle>
          <CardDescription>
            Builds hashes, categories (documents, images, code, …), duplicate hints, and static checks. Scan depth and
            ignore rules come from{" "}
            <Link href="/settings" className="text-emerald-400 hover:underline">
              Settings
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {busy && <Progress value={66} />}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!selectedId || busy || folders.length === 0}
              onClick={() => void runScan()}
            >
              {busy ? "Scanning…" : "Start scan"}
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={resetForm}>
              Clear form
            </Button>
          </div>
          {result?.risk && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-zinc-400">Risk score</span>
              <Badge variant="warn">{result.risk.totalScore}</Badge>
              <Badge>{result.risk.label.replace(/_/g, " ")}</Badge>
              {result.sessionId && (
                <>
                  <Button variant="secondary" size="sm" asChild>
                    <Link href={`/findings?session=${result.sessionId}`}>View findings</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/actions?session=${result.sessionId}`}>Planned actions</Link>
                  </Button>
                </>
              )}
            </div>
          )}
          {(result?.llmRiskExplanation || result?.llmRiskExplanationError) && (
            <RiskExplanationCard
              explanation={result.llmRiskExplanation}
              error={result.llmRiskExplanationError ?? null}
            />
          )}
          {result?.stats?.categoryCounts && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <p className="mb-2 text-sm font-medium text-zinc-300">Files by category</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(result.stats.categoryCounts).map(([cat, n]) => (
                  <Badge key={cat} variant="default">
                    {categoryLabels[cat] ?? cat}: {n}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {result?.errors && result.errors.length > 0 && (
            <p className="text-xs text-amber-600/90">
              Some paths could not be read: {result.errors.slice(0, 3).join("; ")}
              {result.errors.length > 3 ? "…" : ""}
            </p>
          )}
          {result != null ? (
            <details className="rounded-lg border border-zinc-800 bg-zinc-950/50">
              <summary className="cursor-pointer px-3 py-2 text-sm text-zinc-400">
                Technical JSON (optional)
              </summary>
              <pre className="max-h-72 overflow-auto border-t border-zinc-800 p-3 text-xs text-zinc-300">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
