import type { InventoryItem } from "@/lib/services/fileScanner.service";
import type { FileCategory } from "@/lib/types/findings";

export type PlannedAction = {
  id: string;
  type:
    | "move_to_category"
    | "move_duplicates_review"
    | "flag_rename_review"
    | "mark_ignore";
  description: string;
  payload: Record<string, unknown>;
};

/**
 * Proposes reversible organization steps only — never executes.
 */
export function buildOrganizationPlan(items: InventoryItem[]): PlannedAction[] {
  const actions: PlannedAction[] = [];
  const byCat = new Map<FileCategory, InventoryItem[]>();
  for (const it of items) {
    const list = byCat.get(it.category) ?? [];
    list.push(it);
    byCat.set(it.category, list);
  }

  for (const [cat, list] of byCat) {
    if (cat === "unknown" || list.length < 3) continue;
    actions.push({
      id: `group-${cat}`,
      type: "move_to_category",
      description: `Create "${cat}" subfolder and move ${list.length} files (preview only until approved).`,
      payload: {
        category: cat,
        paths: list.map((x) => x.relativePath).slice(0, 200),
      },
    });
  }

  const hashGroups = new Map<string, InventoryItem[]>();
  for (const it of items) {
    if (!it.sha256) continue;
    const g = hashGroups.get(it.sha256) ?? [];
    g.push(it);
    hashGroups.set(it.sha256, g);
  }
  for (const [, group] of hashGroups) {
    if (group.length < 2) continue;
    actions.push({
      id: `dup-${group[0]!.sha256!.slice(0, 12)}`,
      type: "move_duplicates_review",
      description: `Move ${group.length - 1} duplicate(s) to a "_review_duplicates" holding area.`,
      payload: {
        keep: group[0]!.relativePath,
        others: group.slice(1).map((x) => x.relativePath),
      },
    });
  }

  for (const it of items) {
    if (it.relativePath.toLowerCase().includes(".pdf.exe")) {
      actions.push({
        id: `flag-${it.relativePath}`,
        type: "flag_rename_review",
        description: `Flag misleading name: ${it.relativePath}`,
        payload: { path: it.relativePath },
      });
    }
  }

  return actions;
}
