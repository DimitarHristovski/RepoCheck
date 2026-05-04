"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Github, Loader2 } from "lucide-react";
import { normalizeGithubRepoUrl } from "@/lib/gitHubCloneUrl";

export function DashboardGithubScan() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [branches, setBranches] = useState<string[]>([]);
  const [branchesBusy, setBranchesBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function loadBranches() {
    const raw = url.trim();
    if (!raw) return;
    setBranchesBusy(true);
    try {
      const res = await fetch("/api/github/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: raw }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        branches?: string[];
        defaultBranch?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Could not load branches.");
      }
      const list = data.branches ?? [];
      setBranches(list);
      if (!branch.trim() && data.defaultBranch) {
        setBranch(data.defaultBranch);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBranches([]);
    } finally {
      setBranchesBusy(false);
    }
  }

  async function runScan() {
    setErr(null);
    setOk(null);
    const raw = url.trim();
    if (!raw) {
      setErr("Paste a GitHub URL, owner/repo, or git@github.com:owner/repo.");
      return;
    }
    setBusy(true);
    try {
      const repoUrl = normalizeGithubRepoUrl(raw);
      const res = await fetch("/api/scan/repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: {
            type: "url",
            url: repoUrl,
            branch: branch.trim() || undefined,
          },
        }),
      });
      const data = (await res.json()) as { error?: unknown; findingsCount?: number; sessionId?: string };
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : JSON.stringify(data.error ?? res.statusText)
        );
      }
      const sid = data.sessionId ?? "";
      setOk(
        sid
          ? `Scan complete (${data.findingsCount ?? 0} signals). Opening Risk Copilot…`
          : `Scan complete (${data.findingsCount ?? 0} signals).`
      );
      setUrl("");
      setBranch("");
      if (sid) {
        router.push(`/?copilotSession=${encodeURIComponent(sid)}`);
      }
      router.refresh();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-zinc-800/80 bg-zinc-950/60">
      <CardHeader className="pb-1">
        <CardTitle className="flex items-center gap-2 text-base text-zinc-100">
          <Github className="size-5 text-zinc-300" />
          Scan any GitHub repo
        </CardTitle>
        <CardDescription>
          Paste a link or <code className="text-zinc-500">owner/repo</code> for any public repository (yours or someone
          else’s). Private repos only work if your Settings token can read them. No GitHub account linking required for
          public URLs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Step 1</p>
          <div className="mt-2 min-w-0 space-y-2">
            <Label htmlFor="gh-url">Repository URL or shorthand</Label>
            <Input
              id="gh-url"
              name="repocheck-github-url"
              autoComplete="off"
              placeholder="https://github.com/other-user/their-repo"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={() => void loadBranches()}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void loadBranches();
                }
              }}
            />
            <p className="text-xs text-zinc-500">
              Works with full links (including <code>/tree/branch</code> paths — repo is detected automatically):{" "}
              <code>https://github.com/facebook/react</code>, or shorthand <code>microsoft/vscode</code>.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-1"
              disabled={branchesBusy}
              onClick={() => void loadBranches()}
            >
              {branchesBusy ? "Loading branches…" : "Load branches"}
            </Button>
          </div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Step 2</p>
          <div className="mt-2 w-full space-y-2">
            <Label htmlFor="gh-branch">Branch (optional)</Label>
            <Input
              id="gh-branch"
              autoComplete="off"
              placeholder="Leave empty to auto-detect default branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            />
            {branches.length > 0 && (
              <div className="space-y-1">
                <Label htmlFor="gh-branch-select">Or choose detected branch</Label>
                <select
                  id="gh-branch-select"
                  className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                >
                  {branches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            className="inline-flex w-full items-center justify-center gap-2 sm:w-auto"
            disabled={busy}
            onClick={() => void runScan()}
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Scanning…
              </>
            ) : (
              "Run scan now"
            )}
          </Button>
          <p className="text-xs text-zinc-500">No code execution. Static analysis only.</p>
        </div>
        {err && <p className="text-sm text-red-400">{err}</p>}
        {ok && <p className="text-sm text-emerald-400/90">{ok}</p>}
      </CardContent>
    </Card>
  );
}
