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
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

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
      setOk(
        `Scan complete (${data.findingsCount ?? 0} signals). Session ${(data.sessionId ?? "").slice(0, 8)}… — refreshing copilot context.`
      );
      setUrl("");
      setBranch("");
      router.refresh();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-zinc-800 bg-zinc-950/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-zinc-100">
          <Github className="size-5 text-zinc-300" />
          Scan GitHub repo directly
        </CardTitle>
        <CardDescription>
          <strong className="font-medium text-zinc-400">Public github.com repos only</strong> — no git install, no
          cloning. RepoCheck downloads GitHub&apos;s ZIP for the branch (default from the API if you leave branch
          empty), extracts under your analysis directory, and runs static heuristics. Private repos and tokens in URLs
          are not supported.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="gh-url">Repository URL</Label>
            <Input
              id="gh-url"
              name="repocheck-github-url"
              autoComplete="off"
              placeholder="e.g. vercel/next.js or https://github.com/org/repo"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void runScan();
              }}
            />
          </div>
          <div className="w-full space-y-2 sm:w-40">
            <Label htmlFor="gh-branch">Branch (optional)</Label>
            <Input
              id="gh-branch"
              autoComplete="off"
              placeholder="main"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            />
          </div>
          <Button
            type="button"
            className="inline-flex w-full items-center justify-center gap-2 sm:w-auto"
            disabled={busy}
            onClick={() => void runScan()}
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Downloading…
              </>
            ) : (
              "Scan public repo"
            )}
          </Button>
        </div>
        {err && <p className="text-sm text-red-400">{err}</p>}
        {ok && <p className="text-sm text-emerald-400/90">{ok}</p>}
      </CardContent>
    </Card>
  );
}
