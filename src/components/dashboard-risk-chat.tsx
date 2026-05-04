"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RiskCopilotMessageBody } from "@/components/risk-copilot-message-body";
import type { CopilotRiskPathHint } from "@/lib/store/repository";
import { Send, Loader2, Paperclip, X } from "lucide-react";
import { buildPathTreeFromHints } from "@/lib/dashboard/pathTree";
import { CopilotDirectoryMap } from "@/components/copilot-directory-map";
import { inferPathTrustTier } from "@/lib/pathTrustTier";

type Role = "user" | "assistant";

type Msg = { id: string; role: Role; content: string };

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const RESPONSE_STYLE_INSTRUCTIONS = `Write responses in a clean ChatGPT-like structure with numbered sections and readable bullets.

Formatting constraints:
• Do NOT use markdown headings (no #, ##, ###).
• Do NOT use dash bullets (-).
• Use numbered sections like 1) Verdict, 2) Confidence, 3) Why, 4) Key Findings, 5) False Positive Notes, 6) If Harmful: What NOT to Do, 7) Recommended Action.
• For bullets, use "•" or "1." style lists.
• Keep language concise, evidence-based, and easy to scan.

Safety guidance rule:
• Always include section 6 with practical "do not" actions when suspicious behavior exists.
• If verdict is CLEAN, include a short precaution note in section 6 and clearly say there is no confirmed harmful behavior.`;

const OVERVIEW_PROMPT = `Using your auditor methodology (steps 1–7), produce a structured assessment of the FINDINGS CONTEXT below.

Follow STEP 7 output format: Summary (verdict + confidence), Key Findings (paths, signal types, why it matters), Context Analysis (normal vs suspicious), Final Reasoning.

Be conversational but structured. Down-weight findings in LOW_TRUST paths unless correlated with other signals. Prefer NEEDS MANUAL REVIEW over false accusation. About 400–700 words unless there are very few findings.`;

const UPLOAD_OVERVIEW_PROMPT = `Focus primarily on the UPLOADED ARTIFACT SCAN section (user-supplied zip/files). Produce a STEP 7 style assessment: Summary, Key Findings, Context Analysis, Final Reasoning. If the store also has other findings, mention how they relate.`;

const SESSION_FOCUS_PROMPT = `The evidence below is ONLY for one focused repository scan session (FOCUSED REPO SCAN SESSION block from attachment context).

Using your auditor methodology, produce the structured assessment format requested in RESPONSE STYLE INSTRUCTIONS.
Treat every finding in this session as primary evidence; ignore unrelated repos unless the user asks.`;

type SessionBundleJson = {
  session?: {
    id: string;
    metadataJson?: Record<string, unknown> | null;
  };
  findings?: Array<{
    severity: string;
    category: string;
    title: string;
    description: string | null;
    filePath: string | null;
    lineHint: string | null;
  }>;
};

function buildSessionFocusAttachment(bundle: SessionBundleJson): string | null {
  const session = bundle.session;
  const findings = bundle.findings ?? [];
  if (!session) return null;

  const meta = session.metadataJson ?? {};
  const sourceRef = String(meta.sourceRef ?? meta.localPath ?? "unknown source");

  const rank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...findings].sort(
    (a, b) =>
      (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9) ||
      (a.title ?? "").localeCompare(b.title ?? "")
  );

  const lines: string[] = [
    "FOCUSED REPO SCAN SESSION (single repository — primary evidence for this reply)",
    `Session ID: ${session.id}`,
    `Source: ${sourceRef}`,
    `Total findings in session: ${sorted.length}`,
    "",
    "Detailed findings (prioritized by severity):",
  ];

  const cap = 80;
  for (let i = 0; i < Math.min(sorted.length, cap); i++) {
    const f = sorted[i]!;
    const tier = inferPathTrustTier(f.filePath);
    lines.push(
      `${i + 1}. [${f.severity}] ${f.category} — ${f.title}`,
      `   File: ${f.filePath ?? "(no path)"}`,
      `   Trust tier (path heuristic): ${tier}`,
      f.lineHint ? `   Hint: ${f.lineHint}` : "",
      `   Scanner note: ${(f.description ?? "").slice(0, 500)}`
    );
  }
  if (sorted.length > cap) {
    lines.push("", `… ${sorted.length - cap} additional findings omitted for size`);
  }

  return lines.filter(Boolean).join("\n");
}

type ApiResult =
  | { ok: true; reply: string }
  | { ok: false; message: string };

export function DashboardRiskChat(props: {
  notableFindingCount: number;
  copilotRiskPathHints: CopilotRiskPathHint[];
  copilotFocusSessionId?: string | null;
}) {
  const { notableFindingCount, copilotRiskPathHints, copilotFocusSessionId } = props;
  const router = useRouter();
  const pathname = usePathname();
  const pathTreeRoot = useMemo(
    () => buildPathTreeFromHints(copilotRiskPathHints),
    [copilotRiskPathHints]
  );
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [attachmentContext, setAttachmentContext] = useState<string | null>(null);
  const [attachmentLabel, setAttachmentLabel] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const dashboardBootstrapDoneRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  const callChat = useCallback(
    async (
      thread: { role: Role; content: string }[],
      attachmentOverride?: string | null
    ): Promise<ApiResult> => {
      const raw =
        attachmentOverride !== undefined ? attachmentOverride : attachmentContext;
      const trimmed = raw?.trim() || undefined;

      setLoading(true);
      setBanner(null);
      try {
        const res = await fetch("/api/dashboard/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: thread,
            ...(trimmed ? { attachmentContext: trimmed } : {}),
          }),
        });
        const data = (await res.json()) as {
          reply?: string;
          error?: string;
          message?: string;
        };
        if (!res.ok) {
          if (data.error === "no_model") {
            const msg =
              data.message ??
              "Configure OPENAI_API_KEY or Ollama in Settings to enable chat.";
            setBanner(msg);
            return { ok: false, message: msg };
          }
          return {
            ok: false,
            message: data.message ?? data.error ?? res.statusText,
          };
        }
        if (!data.reply) return { ok: false, message: "Empty reply from model." };
        return { ok: true, reply: data.reply.trim() };
      } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : String(e) };
      } finally {
        setLoading(false);
      }
    },
    [attachmentContext]
  );

  useEffect(() => {
    if (copilotFocusSessionId) return;
    if (dashboardBootstrapDoneRef.current) return;
    dashboardBootstrapDoneRef.current = true;

    if (notableFindingCount === 0) {
      setMessages([]);
      return;
    }

    void (async () => {
      const result = await callChat(
        [{ role: "user", content: `${OVERVIEW_PROMPT}\n\n${RESPONSE_STYLE_INSTRUCTIONS}` }],
        null
      );
      if (result.ok) {
        setMessages([{ id: genId(), role: "assistant", content: result.reply }]);
      } else {
        setMessages([
          {
            id: genId(),
            role: "assistant",
            content:
              result.message +
              "\n\nYou can still attach a zip, use GitHub scan, or configure an LLM under Settings.",
          },
        ]);
      }
    })();
  }, [notableFindingCount, callChat, copilotFocusSessionId]);

  useEffect(() => {
    if (!copilotFocusSessionId) return;
    let cancelled = false;

    void (async () => {
      setBanner(null);
      setMessages([
        {
          id: genId(),
          role: "assistant",
          content: "Loading this repository scan into Risk Copilot…",
        },
      ]);

      try {
        const res = await fetch(`/api/sessions/${copilotFocusSessionId}`, {
          cache: "no-store",
        });
        const bundle = (await res.json()) as SessionBundleJson & { error?: string };
        if (!res.ok || !bundle.session) {
          throw new Error(bundle.error ?? res.statusText ?? "Session not found");
        }

        const block = buildSessionFocusAttachment(bundle);
        if (!block) throw new Error("Could not build scan context.");

        const meta = bundle.session.metadataJson ?? {};
        const sourceRef = String(meta.sourceRef ?? meta.localPath ?? "repository scan");
        const count = bundle.findings?.length ?? 0;

        setAttachmentContext(block);
        setAttachmentLabel(`Guardian / focused repo: ${sourceRef}`);

        const result = await callChat(
          [{ role: "user", content: `${SESSION_FOCUS_PROMPT}\n\n${RESPONSE_STYLE_INSTRUCTIONS}` }],
          block
        );

        if (cancelled) return;

        dashboardBootstrapDoneRef.current = true;

        const userLine: Msg = {
          id: genId(),
          role: "user",
          content: `[Guardian alert → Risk Copilot] Review scan session ${copilotFocusSessionId.slice(0, 8)}… · ${count} heuristic signals · ${sourceRef}`,
        };

        if (result.ok) {
          setMessages([
            userLine,
            { id: genId(), role: "assistant", content: result.reply },
          ]);
        } else {
          setMessages([
            userLine,
            {
              id: genId(),
              role: "assistant",
              content:
                result.message +
                "\n\nFindings for this session are still attached above as context; configure an LLM under Settings for full Copilot answers.",
            },
          ]);
        }

        router.replace(pathname || "/", { scroll: false });
        router.refresh();
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setMessages([
          {
            id: genId(),
            role: "assistant",
            content: `Could not load this scan in Risk Copilot: ${msg}`,
          },
        ]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [copilotFocusSessionId, callChat, router, pathname]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg: Msg = { id: genId(), role: "user", content: trimmed };
    const thread = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setInput("");
    setMessages((prev) => [...prev, userMsg]);

    const result = await callChat(thread);
    if (result.ok) {
      setMessages((prev) => [
        ...prev,
        { id: genId(), role: "assistant", content: result.reply },
      ]);
    } else {
      setMessages((prev) => [
        ...prev,
        { id: genId(), role: "assistant", content: result.message },
      ]);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list?.length) return;
    setUploadBusy(true);
    setBanner(null);
    try {
      const fd = new FormData();
      for (let i = 0; i < list.length; i++) {
        fd.append("files", list[i]!);
      }
      const res = await fetch("/api/dashboard/analyze-upload", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as {
        error?: string;
        contextBlock?: string;
        fileNames?: string[];
        findingsCount?: number;
        sessionId?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Upload analysis failed");
      }
      const block = data.contextBlock ?? "";
      const names = (data.fileNames ?? []).join(", ");
      setAttachmentContext(block);
      setAttachmentLabel(names || "upload");

      const result = await callChat(
        [{ role: "user", content: `${UPLOAD_OVERVIEW_PROMPT}\n\n${RESPONSE_STYLE_INSTRUCTIONS}` }],
        block
      );

      const sid = data.sessionId ?? "";
      const sessionNote = sid
        ? ` Saved as session ${sid.slice(0, 8)}… — use Recent scans → Findings / Actions.`
        : "";

      setMessages((prev) => {
        const userLine: Msg = {
          id: genId(),
          role: "user",
          content: `[Attached: ${names}] · ${data.findingsCount ?? 0} heuristic signals.${sessionNote}`,
        };
        if (result.ok) {
          return [
            ...prev,
            userLine,
            { id: genId(), role: "assistant", content: result.reply },
          ];
        }
        return [
          ...prev,
          userLine,
          { id: genId(), role: "assistant", content: result.message },
        ];
      });
      router.refresh();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : String(err));
    } finally {
      setUploadBusy(false);
      e.target.value = "";
    }
  }

  function clearAttachment() {
    setAttachmentContext(null);
    setAttachmentLabel(null);
  }

  return (
    <div className="flex min-h-[24rem] flex-col bg-transparent">
      <div className="border-b border-zinc-800/80 px-2 py-3 sm:px-3">
        <h2 className="text-lg font-semibold text-zinc-50">Risk copilot</h2>
        <p className="text-xs text-zinc-500">
          Ask questions about current findings and optional uploaded files (static analysis only). Paths with medium+
          scanner hits are underlined (
          <span className="text-red-300/90">critical</span>,{" "}
          <span className="text-orange-200/90">high</span>,{" "}
          <span className="text-amber-200/80">medium</span>).
        </p>
        {attachmentLabel && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <Paperclip className="size-3.5 shrink-0" />
            <span className="truncate">Context: {attachmentLabel}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-zinc-500"
              onClick={clearAttachment}
            >
              <X className="size-3.5" />
              Clear upload context
            </Button>
          </div>
        )}
        {banner && (
          <p className="mt-2 text-xs text-amber-200/90">
            {banner}{" "}
            <Link href="/settings" className="text-emerald-400 underline">
              Settings
            </Link>
          </p>
        )}
      </div>

      <div className="min-h-[20rem] flex-1 space-y-4 px-1 py-3 sm:px-2 sm:py-4">
        <CopilotDirectoryMap
          root={pathTreeRoot}
          pathCount={copilotRiskPathHints.length}
        />
        {messages.map((m) => (
          <div
            key={m.id}
            className={
              m.role === "user"
                ? "ml-auto max-w-[96%] rounded-3xl border border-emerald-900/50 bg-emerald-950/40 px-3 py-3 text-sm text-zinc-100 sm:max-w-[90%] sm:px-4"
                : "mr-auto max-w-[96%] rounded-3xl border border-zinc-700/70 bg-zinc-900 px-3 py-3 text-sm text-zinc-200 sm:max-w-[90%] sm:px-4"
            }
          >
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {m.role === "user" ? "You" : "RepoCheck"}
            </p>
            <RiskCopilotMessageBody text={m.content} riskPathHints={copilotRiskPathHints} />
          </div>
        ))}
        {(loading || uploadBusy) && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="size-4 animate-spin" />
            {uploadBusy ? "Scanning upload…" : "Thinking…"}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-zinc-800/80 bg-zinc-950/30 p-2 sm:p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            accept=".zip,.txt,.md,.json,.js,.jsx,.mjs,.cjs,.ts,.tsx,.yml,.yaml,.sh,.ps1,.bat,.py,.toml"
            onChange={(e) => void handleFileChange(e)}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={uploadBusy || loading}
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="size-4" />
            Attach zip / files
          </Button>
          <span className="text-[10px] text-zinc-500">
            Max 6 files. PDFs not parsed.
          </span>
        </div>
        <div className="mt-2 flex items-end gap-2">
          <textarea
            className="min-h-[44px] flex-1 resize-none rounded-2xl border border-zinc-700/80 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-900/50"
            rows={2}
            placeholder="Ask about a file, severity, or what to verify…"
            value={input}
            autoComplete="off"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />
          <Button
            type="button"
            className="shrink-0 rounded-2xl"
            disabled={loading || uploadBusy || !input.trim()}
            onClick={() => void handleSend()}
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
