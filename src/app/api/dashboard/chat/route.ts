import { NextResponse } from "next/server";
import { z } from "zod";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import {
  buildRiskChatFindingsContext,
  DASHBOARD_CHAT_SYSTEM,
} from "@/lib/services/dashboardChat.service";
import { createChatModel } from "@/lib/llm/modelAdapter";

export const runtime = "nodejs";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(16_000),
});

const bodySchema = z.object({
  messages: z.array(messageSchema).max(48),
  /** Static scan summary from uploaded zip/docs (not persisted to store). */
  attachmentContext: z.string().max(120_000).optional(),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const model = createChatModel();
  if (!model) {
    return NextResponse.json(
      {
        error: "no_model",
        message:
          "No LLM configured. Set OPENAI_API_KEY or configure Ollama in Settings.",
      },
      { status: 503 }
    );
  }

  const context = buildRiskChatFindingsContext();
  let systemText = DASHBOARD_CHAT_SYSTEM + context;
  if (parsed.data.attachmentContext?.trim()) {
    systemText +=
      "\n\n---\nUPLOADED ARTIFACT SCAN (user-supplied zip/files; treat as additional evidence, same restraint rules):\n" +
      parsed.data.attachmentContext.trim();
  }

  const lcMessages = [
    new SystemMessage(systemText),
    ...parsed.data.messages.map((m) =>
      m.role === "user"
        ? new HumanMessage(m.content)
        : new AIMessage(m.content)
    ),
  ];

  try {
    const res = await model.invoke(lcMessages);
    const text =
      typeof res.content === "string"
        ? res.content
        : JSON.stringify(res.content);
    return NextResponse.json({ reply: text.trim() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "invoke_failed", message: msg }, { status: 502 });
  }
}
