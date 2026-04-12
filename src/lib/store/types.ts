export type ApprovedFolderRow = {
  id: string;
  path: string;
  label: string | null;
  createdAt: string;
};

export type ScanSessionRow = {
  id: string;
  type: "folder" | "repo" | "mixed" | "upload";
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  approvedFolderId: string | null;
  repositoryId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  metadataJson: Record<string, unknown> | null;
  createdAt: string;
};

export type ScannedItemRow = {
  id: string;
  sessionId: string;
  relativePath: string;
  absolutePath: string;
  extension: string | null;
  sizeBytes: number;
  sha256: string | null;
  mimeHint: string | null;
  category: string;
  createdAtFs: string | null;
  modifiedAtFs: string | null;
  flagsJson: string[] | null;
  metadataJson: Record<string, unknown> | null;
};

export type RepositoryRow = {
  id: string;
  sourceType: "local" | "clone" | "archive";
  sourceRef: string;
  localPath: string;
  clonedAt: string | null;
  createdAt: string;
};

export type FindingRow = {
  id: string;
  sessionId: string;
  repositoryId: string | null;
  severity: "info" | "low" | "medium" | "high" | "critical";
  category: string;
  title: string;
  description: string;
  evidenceJson: Record<string, unknown> | null;
  filePath: string | null;
  lineHint: string | null;
  reviewed: boolean;
  createdAt: string;
};

export type RiskScoreRow = {
  id: string;
  sessionId: string;
  totalScore: number;
  confidence: number;
  label: "low_risk" | "suspicious" | "high_risk" | "strongly_unsafe";
  subscoresJson: Record<string, number> | null;
  rationaleJson: string[] | null;
  createdAt: string;
};

export type ProposedActionRow = {
  id: string;
  sessionId: string;
  actionType: string;
  payloadJson: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | "applied";
  reversible: boolean;
  createdAt: string;
};

export type AuditLogRow = {
  id: string;
  actor: string;
  action: string;
  resource: string | null;
  detailJson: Record<string, unknown> | null;
  createdAt: string;
};

export type RepoCheckStore = {
  version: number;
  approvedFolders: ApprovedFolderRow[];
  scanSessions: ScanSessionRow[];
  scannedItems: ScannedItemRow[];
  repositories: RepositoryRow[];
  findings: FindingRow[];
  riskScores: RiskScoreRow[];
  proposedActions: ProposedActionRow[];
  auditLogs: AuditLogRow[];
  /** Serialized `AppSettings` or null for defaults */
  appSettings: unknown | null;
};
