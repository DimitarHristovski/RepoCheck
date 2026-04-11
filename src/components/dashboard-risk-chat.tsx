"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";

type Role = "user" | "assistant";

type Msg = { id: string; role: Role; content: string };

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const OVERVIEW_PROMPT = `Give a ChatGPT-style overview of my latest static scan findings from your context: prioritize files to review first, what each class of signal might mean if abused, and practical next steps. Use markdown ## headings and bullet lists. Stay grounded only in the paths and descriptions you were given — no invented files. About 300–500 words unless there are very few findings.`;

type ApiResult =
  | { ok: true; reply: string }
  | { ok: false; message: string };

export function DashboardRiskChat(props: {
  notableFindingCount: number;
}) {
  const { notableFindingCount } = props;
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const bootstrapOnce = useRef(false);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  const callChat = useCallback(async (thread: { role: Role; content: string }[]): Promise<ApiResult> => {
    setLoading(true);
    setBanner(null);
    try {
      const res = await fetch("/api/dashboard/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: thread }),
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
  }, []);

  useEffect(() => {
    if (bootstrapOnce.current) return;
    bootstrapOnce.current = true;

    if (notableFindingCount === 0) {
      setMessages([
        {
          id: genId(),
          role: "assistant",
          content:
            "I don’t have any medium-or-higher findings in your local store yet. Run a Folder scan or Repo scan, then refresh this page — I’ll summarize the risky patterns and files so we can talk them through.",
        },
      ]);
      return;
    }

    void (async () => {
      const result = await callChat([{ role: "user", content: OVERVIEW_PROMPT }]);
      if (result.ok) {
        setMessages([{ id: genId(), role: "assistant", content: result.reply }]);
      } else {
        setMessages([
          {
            id: genId(),
            role: "assistant",
            content:
              result.message +
              "\n\nYou can still review structured findings below or configure an LLM under Settings.",
          },
        ]);
      }
    })();
  }, [notableFindingCount, callChat]);

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

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-xl">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h2 className="text-lg font-semibold text-zinc-50">Risk copilot</h2>
        <p className="text-xs text-zinc-500">
          Chat about your latest static findings (paths &amp; short descriptions only). Ask follow-ups like which
          file to open first or how to verify safely — not a malware verdict.
        </p>
        {banner && (
          <p className="mt-2 text-xs text-amber-200/90">
            {banner}{" "}
            <Link href="/settings" className="text-emerald-400 underline">
              Settings
            </Link>
          </p>
        )}
      </div>

      <div className="min-h-[min(420px,50vh)] max-h-[min(560px,60vh)] space-y-4 overflow-y-auto px-4 py-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={
              m.role === "user"
                ? "ml-auto max-w-[92%] rounded-2xl border border-emerald-900/40 bg-emerald-950/35 px-4 py-3 text-sm text-zinc-100"
                : "mr-auto max-w-[92%] rounded-2xl border border-zinc-700/80 bg-zinc-900/80 px-4 py-3 text-sm text-zinc-200"
            }
          >
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {m.role === "user" ? "You" : "RepoCheck"}
            </p>
            <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="size-4 animate-spin" />
            Thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-zinc-800 p-3">
        <div className="flex gap-2">
          <textarea
            className="min-h-[44px] flex-1 resize-none rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-900/50"
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
            className="shrink-0 self-end"
            disabled={loading || !input.trim()}
            onClick={() => void handleSend()}
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
