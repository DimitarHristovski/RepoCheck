import { randomUUID } from "crypto";
import { readStore, mutateStore } from "@/lib/store/persistence";
import type {
  ApprovedFolderRow,
  FindingRow,
  ProposedActionRow,
  RiskScoreRow,
  ScanSessionRow,
  ScannedItemRow,
} from "@/lib/store/types";
import type { HeuristicFinding } from "@/lib/types/findings";
import type { InventoryItem } from "@/lib/services/fileScanner.service";
import type { PlannedAction } from "@/lib/services/organizationPlanner.service";
import type { RiskScoreResult } from "@/lib/services/riskScorer.service";

function iso(d = new Date()) {
  return d.toISOString();
}

function sortByCreatedAtDesc<T extends { createdAt: string }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function listApprovedFolders(): ApprovedFolderRow[] {
  return readStore().approvedFolders;
}

export function listApprovedFolderPaths(): string[] {
  return readStore().approvedFolders.map((f) => f.path);
}

export function getApprovedFolderById(id: string): ApprovedFolderRow | undefined {
  return readStore().approvedFolders.find((f) => f.id === id);
}

export function insertApprovedFolder(row: Omit<ApprovedFolderRow, "createdAt">): void {
  mutateStore((s) => {
    s.approvedFolders.push({ ...row, createdAt: iso() });
  });
}

export function deleteApprovedFolder(id: string): ApprovedFolderRow | undefined {
  let removed: ApprovedFolderRow | undefined;
  mutateStore((s) => {
    const i = s.approvedFolders.findIndex((f) => f.id === id);
    if (i >= 0) {
      removed = s.approvedFolders[i];
      s.approvedFolders.splice(i, 1);
    }
  });
  return removed;
}

export function getApprovedFolderByPath(p: string): ApprovedFolderRow | undefined {
  return readStore().approvedFolders.find((f) => f.path === p);
}

export function listScanSessions(limit = 50): ScanSessionRow[] {
  return sortByCreatedAtDesc(readStore().scanSessions).slice(0, limit);
}

export function getScanSession(id: string): ScanSessionRow | undefined {
  return readStore().scanSessions.find((x) => x.id === id);
}

export function getSessionBundle(id: string): {
  session: ScanSessionRow | undefined;
  scannedItems: ScannedItemRow[];
  findings: FindingRow[];
  riskScores: RiskScoreRow[];
  proposedActions: ProposedActionRow[];
} {
  const s = readStore();
  const session = s.scanSessions.find((x) => x.id === id);
  return {
    session,
    scannedItems: s.scannedItems.filter((i) => i.sessionId === id),
    findings: sortByCreatedAtDesc(s.findings.filter((f) => f.sessionId === id)),
    riskScores: s.riskScores.filter((r) => r.sessionId === id),
    proposedActions: s.proposedActions.filter((a) => a.sessionId === id),
  };
}

export function listFindingsFiltered(input: {
  sessionId?: string | null;
  severity?: FindingRow["severity"] | null;
  limit?: number;
}): FindingRow[] {
  let list = readStore().findings;
  if (input.sessionId) {
    list = list.filter((f) => f.sessionId === input.sessionId);
  }
  if (input.severity) {
    list = list.filter((f) => f.severity === input.severity);
  }
  list = sortByCreatedAtDesc(list);
  if (input.limit) list = list.slice(0, input.limit);
  return list;
}

export function updateFindingReviewed(
  id: string,
  reviewed: boolean
): FindingRow | undefined {
  let out: FindingRow | undefined;
  mutateStore((s) => {
    const f = s.findings.find((x) => x.id === id);
    if (f) {
      f.reviewed = reviewed;
      out = f;
    }
  });
  return out;
}

export function getFindingById(id: string): FindingRow | undefined {
  return readStore().findings.find((f) => f.id === id);
}

export function setProposedActionStatus(
  id: string,
  status: ProposedActionRow["status"]
): boolean {
  let ok = false;
  mutateStore((s) => {
    const a = s.proposedActions.find((x) => x.id === id);
    if (a) {
      a.status = status;
      ok = true;
    }
  });
  return ok;
}

export function getProposedActionById(id: string): ProposedActionRow | undefined {
  return readStore().proposedActions.find((a) => a.id === id);
}

export function persistFolderScan(input: {
  approvedFolderId: string | null;
  items: InventoryItem[];
  heuristicFindings: HeuristicFinding[];
  risk: RiskScoreResult;
  planned: PlannedAction[];
  sessionType: "folder" | "repo" | "mixed";
  repositoryId?: string | null;
}): { sessionId: string } {
  const sessionId = randomUUID();
  mutateStore((s) => {
    s.scanSessions.push({
      id: sessionId,
      type: input.sessionType,
      status: "completed",
      approvedFolderId: input.approvedFolderId,
      repositoryId: input.repositoryId ?? null,
      startedAt: iso(),
      completedAt: iso(),
      errorMessage: null,
      metadataJson: {},
      createdAt: iso(),
    });

    for (const it of input.items) {
      s.scannedItems.push({
        id: randomUUID(),
        sessionId,
        relativePath: it.relativePath,
        absolutePath: it.absolutePath,
        extension: it.extension || null,
        sizeBytes: it.sizeBytes,
        sha256: it.sha256,
        mimeHint: null,
        category: it.category,
        createdAtFs: it.createdAtFs ? iso(it.createdAtFs) : null,
        modifiedAtFs: it.modifiedAtFs ? iso(it.modifiedAtFs) : null,
        flagsJson: it.flags,
        metadataJson: { suspiciousCount: it.suspicious.length },
      });
    }

    for (const f of input.heuristicFindings) {
      s.findings.push({
        id: randomUUID(),
        sessionId,
        repositoryId: input.repositoryId ?? null,
        severity: f.severity,
        category: f.category,
        title: f.title,
        description: f.description,
        evidenceJson: f.evidence,
        filePath: f.filePath ?? null,
        lineHint: f.lineHint ?? null,
        reviewed: false,
        createdAt: iso(),
      });
    }

    s.riskScores.push({
      id: randomUUID(),
      sessionId,
      totalScore: input.risk.totalScore,
      confidence: input.risk.confidence,
      label: input.risk.label,
      subscoresJson: input.risk.subscores,
      rationaleJson: input.risk.rationale,
      createdAt: iso(),
    });

    for (const a of input.planned) {
      s.proposedActions.push({
        id: randomUUID(),
        sessionId,
        actionType: a.type,
        payloadJson: { ...a.payload, description: a.description, planId: a.id },
        status: "pending",
        reversible: true,
        createdAt: iso(),
      });
    }
  });
  return { sessionId };
}

export function persistRepoRecord(input: {
  sourceType: "local" | "clone";
  sourceRef: string;
  localPath: string;
}): string {
  const id = randomUUID();
  mutateStore((s) => {
    s.repositories.push({
      id,
      sourceType: input.sourceType,
      sourceRef: input.sourceRef,
      localPath: input.localPath,
      clonedAt: input.sourceType === "clone" ? iso() : null,
      createdAt: iso(),
    });
  });
  return id;
}

export function appendAuditLog(input: {
  id: string;
  actor: string;
  action: string;
  resource?: string | null;
  detailJson?: Record<string, unknown> | null;
}): void {
  mutateStore((s) => {
    s.auditLogs.push({
      id: input.id,
      actor: input.actor,
      action: input.action,
      resource: input.resource ?? null,
      detailJson: input.detailJson ?? null,
      createdAt: iso(),
    });
  });
}

export function readAppSettingsBlob(): unknown | null {
  return readStore().appSettings;
}

export function writeAppSettingsBlob(value: unknown): void {
  mutateStore((s) => {
    s.appSettings = value;
  });
}

export function getDashboardSnapshot(): {
  approvedFolderCount: number;
  folders: ApprovedFolderRow[];
  recentSessions: ScanSessionRow[];
  flaggedFindings: FindingRow[];
  riskTrend: RiskScoreRow[];
} {
  const s = readStore();
  const recentSessions = sortByCreatedAtDesc(s.scanSessions).slice(0, 10);
  const flagged = sortByCreatedAtDesc(
    s.findings.filter((f) => f.severity === "high" || f.severity === "critical")
  ).slice(0, 12);
  const riskTrend = sortByCreatedAtDesc(s.riskScores).slice(0, 12);
  return {
    approvedFolderCount: s.approvedFolders.length,
    folders: s.approvedFolders,
    recentSessions,
    flaggedFindings: flagged,
    riskTrend,
  };
}

/** Health check: ensure store directory is writable */
export function touchStore(): void {
  mutateStore(() => {
    /* no-op mutation rewrites file */
  });
}
