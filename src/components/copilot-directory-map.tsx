"use client";

import { useState } from "react";
import { ChevronRight, Folder, FileWarning } from "lucide-react";
import type { PathTreeNode } from "@/lib/dashboard/pathTree";
import { sortedChildKeys, worstSeverityInSubtree } from "@/lib/dashboard/pathTree";
import { cn } from "@/lib/utils";

function severityStyles(sev: "critical" | "high" | "medium" | undefined): string {
  if (sev === "critical" || sev === "high") {
    return "text-red-400 font-medium";
  }
  if (sev === "medium") {
    return "text-amber-400/95";
  }
  return "text-zinc-400";
}

function TreeRow({
  node,
  depth,
}: {
  node: PathTreeNode;
  depth: number;
}) {
  const [open, setOpen] = useState(depth < 2);
  const keys = sortedChildKeys(node);
  const isLeaf = keys.length === 0;
  const hasToxic = Boolean(node.severity);
  const isDir = !isLeaf;
  const folderToxic = isDir ? worstSeverityInSubtree(node) : undefined;

  if (node.segment === "" && keys.length === 0) {
    return null;
  }

  if (node.segment === "") {
    return (
      <ul className="space-y-0.5 font-mono text-[11px] leading-snug">
        {keys.map((k) => (
          <TreeRow key={k} node={node.children.get(k)!} depth={depth} />
        ))}
      </ul>
    );
  }

  return (
    <li className="select-none">
      {isDir ? (
        <div>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-zinc-800/60"
            style={{ paddingLeft: Math.max(0, depth - 1) * 12 }}
          >
            <ChevronRight
              className={cn("size-3 shrink-0 text-zinc-500 transition-transform", open && "rotate-90")}
            />
            <Folder
              className={cn(
                "size-3 shrink-0",
                folderToxic && (folderToxic === "medium" ? "text-amber-500/90" : "text-red-400/90")
              )}
            />
            <span className={folderToxic ? severityStyles(folderToxic) : "text-zinc-300"}>
              {node.segment}
            </span>
          </button>
          {open && (
            <ul className="border-l border-zinc-800/80 pl-1">
              {keys.map((k) => (
                <TreeRow key={k} node={node.children.get(k)!} depth={depth + 1} />
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div
          className={cn(
            "flex items-center gap-1.5 rounded px-1 py-0.5",
            hasToxic && "bg-red-950/35"
          )}
          style={{ paddingLeft: (depth - 1) * 12 + 4 }}
        >
          <FileWarning
            className={cn(
              "size-3 shrink-0",
              hasToxic ? "text-red-400" : "text-zinc-600"
            )}
          />
          <span className={cn(severityStyles(node.severity), "break-all")} title={node.pathKey}>
            {node.segment}
          </span>
          {node.severity ? (
            <span className={cn("shrink-0 text-[9px] uppercase tracking-wide", severityStyles(node.severity))}>
              {node.severity}
            </span>
          ) : null}
        </div>
      )}
    </li>
  );
}

export function CopilotDirectoryMap(props: { root: PathTreeNode; pathCount: number }) {
  const { root, pathCount } = props;
  if (pathCount === 0) {
    return (
      <p className="text-xs text-zinc-500">
        No medium+ finding paths in the store yet. Run a repo scan or attach files — paths with signals appear here in
        red (critical/high) or amber (medium).
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-800/90 bg-zinc-950/80 px-3 py-2">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        Finding paths map · {pathCount} file{pathCount === 1 ? "" : "s"}
      </p>
      <div className="max-h-48 overflow-y-auto pr-1">
        <TreeRow node={root} depth={0} />
      </div>
      <p className="mt-2 text-[10px] text-zinc-600">
        Red = critical/high; amber = medium. Folders group paths from your saved repo and upload scans.
      </p>
    </div>
  );
}
