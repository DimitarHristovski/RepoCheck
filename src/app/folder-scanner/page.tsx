"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

type Folder = { id: string; path: string; label: string | null };

export default function FolderScannerPage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [pathInput, setPathInput] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/folders")
      .then((r) => r.json())
      .then((d) => {
        setFolders(d.folders ?? []);
        if (d.folders?.[0]) setSelectedId(d.folders[0].id);
      })
      .catch(() => setErr("Could not load folders"));
  }, []);

  async function addFolder() {
    setErr(null);
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathInput }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error ?? "Failed");
      return;
    }
    setFolders((f) => [...f.filter((x) => x.id !== data.folder.id), data.folder]);
    setSelectedId(data.folder.id);
    setPathInput("");
  }

  async function runScan() {
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const res = await fetch("/api/scan/folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvedFolderId: selectedId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ? JSON.stringify(data.error) : res.statusText);
      setResult(data);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  const risk = result as { risk?: { totalScore: number; label: string } } | null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50">Folder Scanner</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Inventory and heuristics run only inside folders you explicitly approve.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Approved folders</CardTitle>
          <CardDescription>Add an absolute path on this machine</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="path">Directory path</Label>
              <Input
                id="path"
                placeholder="/Users/you/Documents/SafeVault"
                value={pathInput}
                onChange={(e) => setPathInput(e.target.value)}
              />
            </div>
            <Button type="button" onClick={() => void addFolder()}>
              Approve folder
            </Button>
          </div>
          <div className="space-y-2">
            <Label>Scan target</Label>
            <select
              className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.path}
                </option>
              ))}
            </select>
          </div>
          {err && <p className="text-sm text-red-400">{err}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Run inventory</CardTitle>
          <CardDescription>
            Builds hashes, categories, duplicate hints, and static suspicious indicators.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {busy && <Progress value={66} />}
          <Button disabled={!selectedId || busy} onClick={() => void runScan()}>
            {busy ? "Scanning…" : "Start scan"}
          </Button>
          {risk?.risk && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-zinc-400">Risk score</span>
              <Badge variant="warn">{risk.risk.totalScore}</Badge>
              <Badge>{risk.risk.label.replace(/_/g, " ")}</Badge>
            </div>
          )}
          {result != null ? (
            <pre className="max-h-96 overflow-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-300">
              {JSON.stringify(result, null, 2)}
            </pre>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
