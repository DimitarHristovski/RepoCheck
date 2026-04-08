"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

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

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [ignoreText, setIgnoreText] = useState("");

  useEffect(() => {
    void fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setSettings(d.settings);
        setIgnoreText((d.settings.ignorePatterns ?? []).join("\n"));
      });
  }, []);

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
    const data = await res.json();
    setSettings(data.settings);
  }

  if (!settings) {
    return <p className="text-sm text-zinc-500">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50">Settings</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Stored in the local JSON file (`data/repocheck-store.json` by default). Environment variables still override provider keys and URLs.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Model provider</CardTitle>
          <CardDescription>OpenAI-compatible endpoints, including Ollama</CardDescription>
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
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Max depth</Label>
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
            <Label>Max file size (MB) hint for UI</Label>
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

      <Button onClick={() => void save()}>Save settings</Button>
    </div>
  );
}
