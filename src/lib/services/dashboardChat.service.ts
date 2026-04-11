import { readStore } from "@/lib/store/persistence";

function sortByCreatedAtDesc<T extends { createdAt: string }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/** Compact snapshot of notable findings for LLM context (metadata / descriptions only). */
export function buildRiskChatFindingsContext(): string {
  const s = readStore();
  const findings = sortByCreatedAtDesc(
    s.findings.filter((f) =>
      ["critical", "high", "medium"].includes(f.severity)
    )
  ).slice(0, 40);

  if (!findings.length) {
    return "No medium-or-higher severity findings in the local store yet. Suggest running a folder or repo scan first.";
  }

  return findings
    .map((f, i) => {
      const path = f.filePath ?? "(no single file path)";
      const desc = (f.description ?? "").slice(0, 400);
      return [
        `${i + 1}. [${f.severity}] ${f.category} — ${f.title}`,
        `   File: ${path}`,
        f.lineHint ? `   Hint: ${f.lineHint}` : null,
        `   Scanner note: ${desc}`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

export const DASHBOARD_CHAT_SYSTEM = `You are RepoCheck's security copilot. You answer in a clear, conversational ChatGPT-style: short paragraphs, optional markdown headings (##), and bullet lists when helpful.

You ONLY know what appears in FINDINGS CONTEXT below — static scanner metadata (paths, titles, short descriptions). You do NOT see full source files unless a description quotes a fragment.

Rules:
- Name files by exact path from the context when discussing risk.
- Never claim proven malware; use careful language (e.g. "could", "worth reviewing", "sometimes used in supply-chain attacks").
- If the user asks about code not listed in the context, say it's not in the current snapshot and suggest re-scanning or opening the file locally.
- Help prioritize what to review first and safer workflows (isolated clone, no install scripts on host, etc.).
- Keep answers focused; avoid repeating the entire context unless asked.

FINDINGS CONTEXT:
`;
