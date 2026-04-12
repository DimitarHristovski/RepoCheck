import type { ReactNode } from "react";
import type { CopilotRiskPathHint } from "@/lib/store/repository";

const SEVERITY_RANK: Record<CopilotRiskPathHint["severity"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
};

function severityHighlightClass(sev: CopilotRiskPathHint["severity"]): string {
  switch (sev) {
    case "critical":
      return "rounded-sm font-medium text-red-300 underline decoration-red-400 decoration-2 underline-offset-2";
    case "high":
      return "rounded-sm font-medium text-orange-200 underline decoration-orange-400 decoration-2 underline-offset-2";
    case "medium":
      return "rounded-sm text-amber-200/95 underline decoration-amber-500/80 decoration-2 underline-offset-1";
    default:
      return "";
  }
}

type Range = { start: number; end: number; severity: CopilotRiskPathHint["severity"] };

/** Non-overlapping spans for known risky paths (longest needles first). */
function findHighlightRanges(
  text: string,
  hints: CopilotRiskPathHint[]
): Range[] {
  if (!hints.length || !text) return [];

  const needleToSeverity = new Map<string, CopilotRiskPathHint["severity"]>();
  for (const h of hints) {
    if (h.path.length < 2) continue;
    for (const needle of [h.path, h.path.replace(/\//g, "\\")]) {
      const prev = needleToSeverity.get(needle);
      if (!prev || SEVERITY_RANK[h.severity] < SEVERITY_RANK[prev]) {
        needleToSeverity.set(needle, h.severity);
      }
    }
  }

  const needles = [...needleToSeverity.entries()]
    .map(([needle, severity]) => ({ needle, severity }))
    .sort((a, b) => b.needle.length - a.needle.length);

  const matches: Range[] = [];
  for (const { needle, severity } of needles) {
    let from = 0;
    while (from <= text.length - needle.length) {
      const idx = text.indexOf(needle, from);
      if (idx === -1) break;
      const end = idx + needle.length;
      const overlaps = matches.some((m) => m.start < end && m.end > idx);
      if (!overlaps) matches.push({ start: idx, end, severity });
      from = idx + 1;
    }
  }
  matches.sort((a, b) => a.start - b.start || a.end - b.end);
  return matches;
}

/** Underline / tint file paths that match store findings (medium+). */
export function RiskCopilotMessageBody(props: {
  text: string;
  riskPathHints: CopilotRiskPathHint[];
}) {
  const { text, riskPathHints } = props;
  const ranges = findHighlightRanges(text, riskPathHints);
  if (!ranges.length) {
    return (
      <span className="block whitespace-pre-wrap leading-relaxed">{text}</span>
    );
  }

  const nodes: ReactNode[] = [];
  let cursor = 0;
  ranges.forEach((r, i) => {
    if (r.start > cursor) {
      nodes.push(<span key={`t-${i}-${cursor}`}>{text.slice(cursor, r.start)}</span>);
    }
    nodes.push(
      <span
        key={`p-${i}-${r.start}`}
        className={severityHighlightClass(r.severity)}
        title={`Scanner: ${r.severity} severity`}
      >
        {text.slice(r.start, r.end)}
      </span>
    );
    cursor = r.end;
  });
  if (cursor < text.length) {
    nodes.push(<span key={`t-end-${cursor}`}>{text.slice(cursor)}</span>);
  }
  return (
    <span className="block whitespace-pre-wrap leading-relaxed">{nodes}</span>
  );
}
