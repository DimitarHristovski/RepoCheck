import type { CopilotRiskPathHint } from "@/lib/store/repository";

export type PathTreeNode = {
  segment: string;
  pathKey: string;
  /** Worst severity at this path (leaf file). */
  severity?: CopilotRiskPathHint["severity"];
  children: Map<string, PathTreeNode>;
};

const RANK: Record<CopilotRiskPathHint["severity"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
};

function worse(
  a: CopilotRiskPathHint["severity"] | undefined,
  b: CopilotRiskPathHint["severity"]
): CopilotRiskPathHint["severity"] {
  if (!a) return b;
  return RANK[b] < RANK[a] ? b : a;
}

/** Build a directory-style tree from deduped path hints (medium+). */
export function buildPathTreeFromHints(hints: CopilotRiskPathHint[]): PathTreeNode {
  const root: PathTreeNode = { segment: "", pathKey: "", children: new Map() };

  for (const { path, severity } of hints) {
    const norm = path.replace(/\\/g, "/").replace(/^\/+/, "").trim();
    if (!norm) continue;
    const parts = norm.split("/").filter(Boolean);
    let cur = root;
    let acc = "";
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      acc = acc ? `${acc}/${part}` : part;
      if (!cur.children.has(part)) {
        cur.children.set(part, {
          segment: part,
          pathKey: acc,
          children: new Map(),
        });
      }
      cur = cur.children.get(part)!;
      if (i === parts.length - 1) {
        cur.severity = worse(cur.severity, severity);
      }
    }
  }

  return root;
}

/** Worst (most severe) signal in this node or any descendant — for coloring parent folders. */
export function worstSeverityInSubtree(
  node: PathTreeNode
): CopilotRiskPathHint["severity"] | undefined {
  let best = node.severity;
  for (const c of node.children.values()) {
    const s = worstSeverityInSubtree(c);
    if (s && (!best || RANK[s] < RANK[best])) best = s;
  }
  return best;
}

export function sortedChildKeys(node: PathTreeNode): string[] {
  return [...node.children.keys()].sort((a, b) => {
    const ca = node.children.get(a)!;
    const cb = node.children.get(b)!;
    const dirA = ca.children.size > 0 ? 0 : 1;
    const dirB = cb.children.size > 0 ? 0 : 1;
    if (dirA !== dirB) return dirA - dirB;
    return a.localeCompare(b, undefined, { sensitivity: "base" });
  });
}
