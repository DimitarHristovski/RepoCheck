import fs from "fs";
import path from "path";
import type { RepoCheckStore } from "@/lib/store/types";

export const STORE_VERSION = 1;

export function emptyStore(): RepoCheckStore {
  return {
    version: STORE_VERSION,
    approvedFolders: [],
    scanSessions: [],
    scannedItems: [],
    repositories: [],
    findings: [],
    riskScores: [],
    proposedActions: [],
    auditLogs: [],
    appSettings: null,
  };
}

export function getStoreFilePath(): string {
  const override = process.env.REPOCHECK_STORE_PATH;
  if (override) return path.resolve(override);
  return path.join(process.cwd(), "data", "repocheck-store.json");
}

export function readStore(): RepoCheckStore {
  const filePath = getStoreFilePath();
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw) as RepoCheckStore;
    if (!data || typeof data !== "object") return emptyStore();
    return {
      ...emptyStore(),
      ...data,
      approvedFolders: data.approvedFolders ?? [],
      scanSessions: data.scanSessions ?? [],
      scannedItems: data.scannedItems ?? [],
      repositories: data.repositories ?? [],
      findings: data.findings ?? [],
      riskScores: data.riskScores ?? [],
      proposedActions: data.proposedActions ?? [],
      auditLogs: data.auditLogs ?? [],
      appSettings: data.appSettings ?? null,
    };
  } catch {
    return emptyStore();
  }
}

export function writeStore(data: RepoCheckStore): void {
  const filePath = getStoreFilePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

export function mutateStore(fn: (draft: RepoCheckStore) => void): void {
  const data = readStore();
  fn(data);
  data.version = STORE_VERSION;
  writeStore(data);
}
