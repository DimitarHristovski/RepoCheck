import type { FileCategory, HeuristicFinding } from "@/lib/types/findings";

/** Minimal shape for persisting scanned inventory rows (repo scans use an empty list). */
export type PersistedInventoryItem = {
  relativePath: string;
  absolutePath: string;
  extension: string;
  sizeBytes: number;
  sha256: string | null;
  category: FileCategory;
  createdAtFs: Date | null;
  modifiedAtFs: Date | null;
  flags: string[];
  suspicious: HeuristicFinding[];
};

export type PersistedPlannedAction = {
  id: string;
  type: string;
  description: string;
  payload: Record<string, unknown>;
};
