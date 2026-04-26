"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type Settings = {
  modelProvider: "openai" | "ollama" | "none";
  privacyModeMetadataOnly: boolean;
  localOnlyMode: boolean;
  promptLogging: boolean;
  guardian: {
    enabled: boolean;
    githubRepos: string[];
    localWatchDirs: string[];
    pollMs: number;
    alertMinSeverity: "critical" | "high" | "medium";
    githubToken: string;
  };
};

type RuntimeInfo = {
  effectiveModelProvider: string;
  hasOpenAiKey: boolean;
  hasOpenAiBaseUrl: boolean;
};
type GuardianRuntime = {
  started: boolean;
  watchedDirs: number;
  githubRepoCount: number;
  pollMs: number;
  enabled: boolean;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null);
  const [guardianRuntime, setGuardianRuntime] = useState<GuardianRuntime | null>(null);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [tokenTestBusy, setTokenTestBusy] = useState(false);
  const [tokenTestMsg, setTokenTestMsg] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/settings")
      .then((r) => r.json())
      .then(
        (d: {
          settings: Settings;
          runtime?: RuntimeInfo;
          guardian?: GuardianRuntime;
        }) => {
          setSettings(d.settings);
          setRuntime(d.runtime ?? null);
          setGuardianRuntime(d.guardian ?? null);
        }
      );
  }, []);

  async function resetStore(scope: "scans" | "all") {
    const ok = window.confirm(
      scope === "all"
        ? "Clear all scan history and legacy store entries (including old folder approvals)?"
        : "Delete all repo scan sessions, findings, and GitHub/archive records from the local store?"
    );
    if (!ok) return;
    setResetBusy(true);
    setResetMsg(null);
    try {
      const res = await fetch("/api/store/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: unknown };
        throw new Error(typeof d.error === "string" ? d.error : "Request failed");
      }
      setResetMsg(scope === "all" ? "Cleared store data (scans + legacy)." : "Cleared scan history.");
    } catch (e) {
      setResetMsg(String(e));
    } finally {
      setResetBusy(false);
    }
  }

  async function save() {
    if (!settings) return;
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...settings }),
    });
    const data = (await res.json()) as {
      settings: Settings;
      runtime?: RuntimeInfo;
      guardian?: GuardianRuntime;
    };
    setSettings(data.settings);
    if (data.runtime) setRuntime(data.runtime);
    if (data.guardian) setGuardianRuntime(data.guardian);
  }

  async function testToken() {
    setTokenTestBusy(true);
    setTokenTestMsg(null);
    try {
      const res = await fetch("/api/guardian/test-token", { method: "POST" });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Token test failed");
      setTokenTestMsg(data.message ?? "Token valid.");
    } catch (e) {
      setTokenTestMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setTokenTestBusy(false);
    }
  }

  if (!settings) {
    return <p className="text-sm text-zinc-500">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50">Settings</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Preferences are stored in <code className="text-zinc-500">data/repocheck-store.json</code>. Env
          vars such as <code className="text-zinc-500">OPENAI_API_KEY</code> apply at runtime for LLM calls.
        </p>
      </div>

      {runtime && (
        <Card className="border-emerald-900/40 bg-emerald-950/20">
          <CardHeader>
            <CardTitle className="text-base text-emerald-100">Effective LLM runtime</CardTitle>
            <CardDescription>What the server will use after merging env + saved settings</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2 text-sm text-zinc-300">
            <span>Provider:</span>
            <Badge variant="default">{runtime.effectiveModelProvider}</Badge>
            {runtime.hasOpenAiKey ? (
              <Badge variant="success">OpenAI key present</Badge>
            ) : (
              <Badge>OpenAI key not set</Badge>
            )}
            {runtime.hasOpenAiBaseUrl && (
              <span className="text-zinc-500">Custom base URL configured</span>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>AI and privacy</CardTitle>
          <CardDescription>
            Saved choice below is used when env does not force a provider. Set to OpenAI here if you use
            keys from the environment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Provider</Label>
            <select
              className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm"
              value={settings.modelProvider}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  modelProvider: e.target.value as Settings["modelProvider"],
                })
              }
            >
              <option value="none">None (static only)</option>
              <option value="openai">OpenAI-compatible</option>
              <option value="ollama">Ollama</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="pm"
              type="checkbox"
              checked={settings.privacyModeMetadataOnly}
              onChange={(e) =>
                setSettings({ ...settings, privacyModeMetadataOnly: e.target.checked })
              }
            />
            <Label htmlFor="pm">Privacy: metadata-only payloads to LLM</Label>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="lo"
              type="checkbox"
              checked={settings.localOnlyMode}
              onChange={(e) =>
                setSettings({ ...settings, localOnlyMode: e.target.checked })
              }
            />
            <Label htmlFor="lo">Prefer local analysis (reminder flag)</Label>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="pl"
              type="checkbox"
              checked={settings.promptLogging}
              onChange={(e) =>
                setSettings({ ...settings, promptLogging: e.target.checked })
              }
            />
            <Label htmlFor="pl">Prompt logging (dev)</Label>
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-900/40 bg-amber-950/10">
        <CardHeader>
          <CardTitle>Guardian (continuous protection)</CardTitle>
          <CardDescription>
            Connect your GitHub repos and local folders for always-on scanning while RepoCheck is running.
            Checks run automatically in the background after Save.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">1) Access</p>
            <div className="mt-2 flex items-center gap-2">
              <input
                id="guardian-enabled"
                type="checkbox"
                checked={settings.guardian.enabled}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    guardian: { ...settings.guardian, enabled: e.target.checked },
                  })
                }
              />
              <Label htmlFor="guardian-enabled">Enable guardian monitoring</Label>
            </div>
            <div className="mt-3 space-y-2">
              <Label>GitHub token (optional, required for private repos)</Label>
              <Input
                type="password"
                autoComplete="off"
                placeholder="ghp_... (stored locally only)"
                value={settings.guardian.githubToken}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    guardian: {
                      ...settings.guardian,
                      githubToken: e.target.value.trim(),
                    },
                  })
                }
              />
              <p className="text-xs text-zinc-500">
                Create a fine-grained token with read access to repository contents:{" "}
                <a
                  href="https://github.com/settings/personal-access-tokens/new"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300"
                >
                  GitHub token setup
                </a>
              </p>
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={tokenTestBusy}
                  onClick={() => void testToken()}
                >
                  {tokenTestBusy ? "Testing…" : "Test token"}
                </Button>
                {tokenTestMsg && <p className="mt-2 text-xs text-zinc-400">{tokenTestMsg}</p>}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">2) Sources to monitor</p>
            <div className="mt-3 space-y-2">
              <Label>GitHub repos (one per line: owner/repo or github URL)</Label>
              <textarea
                className="min-h-24 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                value={settings.guardian.githubRepos.join("\n")}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    guardian: {
                      ...settings.guardian,
                      githubRepos: e.target.value
                        .split("\n")
                        .map((x) => x.trim())
                        .filter(Boolean),
                    },
                  })
                }
              />
            </div>
            <div className="mt-3 space-y-2">
              <Label>Local folders to watch (absolute paths, one per line)</Label>
              <textarea
                className="min-h-24 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                value={settings.guardian.localWatchDirs.join("\n")}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    guardian: {
                      ...settings.guardian,
                      localWatchDirs: e.target.value
                        .split("\n")
                        .map((x) => x.trim())
                        .filter(Boolean),
                    },
                  })
                }
              />
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">3) Runtime behavior</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>GitHub poll interval (ms)</Label>
                <input
                  type="number"
                  min={60000}
                  step={1000}
                  className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm"
                  value={settings.guardian.pollMs}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      guardian: {
                        ...settings.guardian,
                        pollMs: Math.max(60000, Number(e.target.value || 300000)),
                      },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Alert threshold</Label>
                <select
                  className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm"
                  value={settings.guardian.alertMinSeverity}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      guardian: {
                        ...settings.guardian,
                        alertMinSeverity: e.target.value as Settings["guardian"]["alertMinSeverity"],
                      },
                    })
                  }
                >
                  <option value="critical">critical</option>
                  <option value="high">high</option>
                  <option value="medium">medium</option>
                </select>
              </div>
            </div>
          </div>

          {guardianRuntime && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs text-zinc-300">
              Runtime: {guardianRuntime.started ? "running" : "stopped"} · enabled=
              {String(guardianRuntime.enabled)} · repos={guardianRuntime.githubRepoCount} · watchedDirs=
              {guardianRuntime.watchedDirs} · pollMs={guardianRuntime.pollMs}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-red-900/40">
        <CardHeader>
          <CardTitle>Local data</CardTitle>
          <CardDescription>
            Repo scans and findings live in{" "}
            <code className="text-zinc-500">data/repocheck-store.json</code>. Clearing removes them from disk;
            saved settings above stay unless you use reset everything (same file; app preferences preserved when
            possible).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            variant="secondary"
            disabled={resetBusy}
            onClick={() => void resetStore("scans")}
          >
            Clear scan history
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-red-900/60 text-red-200 hover:bg-red-950/40"
            disabled={resetBusy}
            onClick={() => void resetStore("all")}
          >
            Reset store (scans + legacy)
          </Button>
          {resetMsg && (
            <p className="w-full text-sm text-zinc-400">{resetMsg}</p>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end">
        <Button onClick={() => void save()}>Save settings</Button>
      </div>
    </div>
  );
}
