"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Settings = {
  modelProvider: "openai" | "ollama" | "none";
  privacyModeMetadataOnly: boolean;
  localOnlyMode: boolean;
  scanDepth: number;
  maxFileSizeMb: number;
  ignorePatterns: string[];
  dangerousExtensions: string[];
  promptLogging: boolean;
};

type RuntimeInfo = {
  effectiveModelProvider: string;
  hasOpenAiKey: boolean;
  hasOpenAiBaseUrl: boolean;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null);
  const [ignoreText, setIgnoreText] = useState("");
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/settings")
      .then((r) => r.json())
      .then(
        (d: {
          settings: Settings;
          runtime?: RuntimeInfo;
        }) => {
          setSettings(d.settings);
          setRuntime(d.runtime ?? null);
          setIgnoreText((d.settings.ignorePatterns ?? []).join("\n"));
        }
      );
  }, []);

  async function resetStore(scope: "scans" | "folders" | "all") {
    const ok = window.confirm(
      scope === "all"
        ? "Remove all approved folders and delete all scan history from the local store?"
        : scope === "folders"
          ? "Remove every approved folder from the local store?"
          : "Delete all scan sessions, findings, and repo clone records from the local store?"
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
      setResetMsg(
        scope === "all"
          ? "Cleared folders and scan history."
          : scope === "folders"
            ? "Removed approved folders."
            : "Cleared scan history."
      );
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
      body: JSON.stringify({
        ...settings,
        ignorePatterns: ignoreText
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    });
    const data = (await res.json()) as {
      settings: Settings;
      runtime?: RuntimeInfo;
    };
    setSettings(data.settings);
    if (data.runtime) setRuntime(data.runtime);
  }

  if (!settings) {
    return <p className="text-sm text-zinc-500">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
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
          <CardTitle>Model provider</CardTitle>
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

      <Card>
        <CardHeader>
          <CardTitle>Scan parameters</CardTitle>
          <CardDescription>Used for folder inventory and repo text-file reads</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Max depth (nested folders)</Label>
            <input
              type="number"
              className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm"
              value={settings.scanDepth}
              onChange={(e) =>
                setSettings({ ...settings, scanDepth: Number(e.target.value) })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Max file size (MB) for content hashing / text scan</Label>
            <input
              type="number"
              className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm"
              value={settings.maxFileSizeMb}
              onChange={(e) =>
                setSettings({ ...settings, maxFileSizeMb: Number(e.target.value) })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Ignore patterns (one per line, substring match)</Label>
            <textarea
              className="min-h-24 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              value={ignoreText}
              onChange={(e) => setIgnoreText(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-900/40">
        <CardHeader>
          <CardTitle>Local data</CardTitle>
          <CardDescription>
            Approved folders, scans, and findings live in{" "}
            <code className="text-zinc-500">data/repocheck-store.json</code>. Clearing here removes them from disk
            (settings above are kept unless you clear everything — app preferences remain in the same file).
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
            variant="secondary"
            disabled={resetBusy}
            onClick={() => void resetStore("folders")}
          >
            Remove all approved folders
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-red-900/60 text-red-200 hover:bg-red-950/40"
            disabled={resetBusy}
            onClick={() => void resetStore("all")}
          >
            Clear folders + scan history
          </Button>
          {resetMsg && (
            <p className="w-full text-sm text-zinc-400">{resetMsg}</p>
          )}
        </CardContent>
      </Card>

      <Button onClick={() => void save()}>Save settings</Button>
    </div>
  );
}
