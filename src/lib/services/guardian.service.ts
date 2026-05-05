import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getConfig } from "@/lib/config";
import { getAppSettings } from "@/lib/settingsStore";
import { analyzeLocalRepo } from "@/lib/services/repoScanner.service";
import {
  downloadGithubRepoArchive,
  fetchGithubDefaultBranch,
} from "@/lib/services/githubPublicArchive.service";
import {
  finalizeScanSession,
  persistRepoRecord,
} from "@/lib/services/scanPersistence.service";
import { appendAuditLog } from "@/lib/store/repository";

type WatchHandle = {
  close: () => void;
};

const severityRank: Record<"critical" | "high" | "medium", number> = {
  critical: 3,
  high: 2,
  medium: 1,
};

function meetsAlertThreshold(
  severity: string,
  threshold: "critical" | "high" | "medium"
): boolean {
  const sev = severityRank[severity as keyof typeof severityRank];
  if (!sev) return false;
  return sev >= severityRank[threshold];
}

let started = false;
let timer: NodeJS.Timeout | null = null;
const watchers: WatchHandle[] = [];
const pendingLocalRuns = new Map<string, NodeJS.Timeout>();
const runningLocalRuns = new Set<string>();
const runningGithubRuns = new Set<string>();
let currentPollMs = 300_000;
let lastRunAt: string | null = null;
let lastSuccessAt: string | null = null;
let lastError: string | null = null;
let lastRunDurationMs: number | null = null;
let nextRunAt: string | null = null;

type RuntimeGuardianConfig = {
  enabled: boolean;
  analysisRootAbs: string;
  githubRepos: string[];
  localWatchDirs: string[];
  pollMs: number;
  alertMinSeverity: "critical" | "high" | "medium";
  githubToken?: string;
};

function unique(list: string[]): string[] {
  return [...new Set(list.map((x) => x.trim()).filter(Boolean))];
}

function extractOwnerRepoToken(input: string): string {
  const raw = input.trim();
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    if (u.hostname !== "github.com") return raw;
    const parts = u.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
    if (parts.length >= 2) return `${parts[0]}/${parts[1]!.replace(/\.git$/i, "")}`;
    return raw;
  } catch {
    return raw;
  }
}

function getRuntimeConfig(): RuntimeGuardianConfig {
  const cfg = getConfig();
  const s = getAppSettings().guardian;
  const envEnabled = cfg.guardianEnabled;
  const githubRepos = unique([
    ...cfg.guardianGithubRepos.map(extractOwnerRepoToken),
    ...s.githubRepos.map(extractOwnerRepoToken),
  ]);
  const localWatchDirs = unique([...cfg.guardianLocalWatchDirs, ...s.localWatchDirs]);
  const enabled = envEnabled || s.enabled || githubRepos.length > 0 || localWatchDirs.length > 0;
  const pollMs = Math.max(60_000, Number(s.pollMs || cfg.guardianPollMs));
  const alertMinSeverity = s.alertMinSeverity ?? cfg.guardianAlertMinSeverity;
  const githubToken = s.githubToken?.trim() || cfg.githubToken;
  return {
    enabled,
    analysisRootAbs: cfg.analysisRootAbs,
    githubRepos,
    localWatchDirs,
    pollMs,
    alertMinSeverity,
    githubToken,
  };
}

function parseOwnerRepo(input: string): { owner: string; repo: string } | null {
  const parts = input.trim().split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { owner: parts[0], repo: parts[1] };
}

async function scanPublicRepo(owner: string, repo: string): Promise<void> {
  const key = `${owner}/${repo}`;
  if (runningGithubRuns.has(key)) return;
  runningGithubRuns.add(key);
  try {
    const cfg = getRuntimeConfig();
    const branch = await fetchGithubDefaultBranch(owner, repo, cfg.githubToken);
    const { localPath } = await downloadGithubRepoArchive({
      owner,
      repo,
      branch,
      analysisRoot: cfg.analysisRootAbs,
      token: cfg.githubToken,
    });
    const sourceRef = `https://github.com/${owner}/${repo}`;
    const repositoryId = persistRepoRecord({
      sourceType: "archive",
      sourceRef,
      localPath,
    });
    const { findings, treeSummary, severityCounts, harmfulByTopFolder } =
      analyzeLocalRepo(localPath);
    const highOrCritical = findings.filter(
      (f) => meetsAlertThreshold(f.severity, cfg.alertMinSeverity)
    );
    const result = await finalizeScanSession({
      findings,
      sessionType: "repo",
      repositoryId,
      plannedDescription:
        "Guardian scan: review suspicious code indicators before executing or trusting this repository.",
      plannedPayload: {
        sourceType: "archive",
        sourceRef,
        localPath,
        mode: "guardian",
      },
      extraSessionMetadata: {
        scanSource: "guardian-github",
        sourceType: "archive",
        sourceRef,
        localPath,
        scanTreeSummary: treeSummary,
        scanSeverityCounts: severityCounts,
        harmfulByTopFolder,
      },
    });
    if (highOrCritical.length > 0) {
      const msg = `[guardian] ${sourceRef} has ${highOrCritical.length} high/critical findings in session ${result.sessionId}`;
      console.warn(msg);
      appendAuditLog({
        id: randomUUID(),
        actor: "guardian",
        action: "alert",
        resource: sourceRef,
        detailJson: {
          minSeverity: cfg.alertMinSeverity,
          count: highOrCritical.length,
          sessionId: result.sessionId,
        },
      });
    }
  } catch (error) {
    console.error(`[guardian] github scan failed for ${key}:`, error);
  } finally {
    runningGithubRuns.delete(key);
  }
}

async function scanLocalDirectory(rootDir: string): Promise<void> {
  if (runningLocalRuns.has(rootDir)) return;
  runningLocalRuns.add(rootDir);
  try {
    const resolved = path.resolve(rootDir);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) return;
    const sourceRef = resolved;
    const repositoryId = persistRepoRecord({
      sourceType: "local",
      sourceRef,
      localPath: resolved,
    });
    const { findings, treeSummary, severityCounts, harmfulByTopFolder } =
      analyzeLocalRepo(resolved);
    const cfg = getRuntimeConfig();
    const highOrCritical = findings.filter(
      (f) => meetsAlertThreshold(f.severity, cfg.alertMinSeverity)
    );
    const result = await finalizeScanSession({
      findings,
      sessionType: "repo",
      repositoryId,
      plannedDescription:
        "Guardian scan: review suspicious code indicators before executing local files or scripts.",
      plannedPayload: {
        sourceType: "local",
        sourceRef,
        localPath: resolved,
        mode: "guardian",
      },
      extraSessionMetadata: {
        scanSource: "guardian-local",
        sourceType: "local",
        sourceRef,
        localPath: resolved,
        scanTreeSummary: treeSummary,
        scanSeverityCounts: severityCounts,
        harmfulByTopFolder,
      },
    });
    if (highOrCritical.length > 0) {
      const msg = `[guardian] ${sourceRef} has ${highOrCritical.length} high/critical findings in session ${result.sessionId}`;
      console.warn(msg);
      appendAuditLog({
        id: randomUUID(),
        actor: "guardian",
        action: "alert",
        resource: sourceRef,
        detailJson: {
          minSeverity: cfg.alertMinSeverity,
          count: highOrCritical.length,
          sessionId: result.sessionId,
        },
      });
    }
  } catch (error) {
    console.error(`[guardian] local scan failed for ${rootDir}:`, error);
  } finally {
    runningLocalRuns.delete(rootDir);
  }
}

function scheduleLocalRescan(rootDir: string): void {
  const existing = pendingLocalRuns.get(rootDir);
  if (existing) clearTimeout(existing);
  const handle = setTimeout(() => {
    pendingLocalRuns.delete(rootDir);
    void scanLocalDirectory(rootDir);
  }, 2000);
  pendingLocalRuns.set(rootDir, handle);
}

async function runGithubPollTick(): Promise<void> {
  const t0 = Date.now();
  lastRunAt = new Date(t0).toISOString();
  lastError = null;
  const cfg = getRuntimeConfig();
  try {
    for (const entry of cfg.githubRepos) {
      const parsed = parseOwnerRepo(entry);
      if (!parsed) {
        console.warn(`[guardian] ignoring invalid github repo entry: ${entry}`);
        continue;
      }
      await scanPublicRepo(parsed.owner, parsed.repo);
    }
    lastSuccessAt = new Date().toISOString();
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
  } finally {
    lastRunDurationMs = Date.now() - t0;
    if (timer) {
      nextRunAt = new Date(Date.now() + currentPollMs).toISOString();
    } else {
      nextRunAt = null;
    }
  }
}

function setupLocalWatchers(): void {
  const cfg = getRuntimeConfig();
  for (const dir of cfg.localWatchDirs) {
    const resolved = path.resolve(dir);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      console.warn(`[guardian] local watch dir not found: ${resolved}`);
      continue;
    }
    scheduleLocalRescan(resolved);
    const watcher = fs.watch(
      resolved,
      { recursive: true },
      () => scheduleLocalRescan(resolved)
    );
    watchers.push({ close: () => watcher.close() });
  }
}

export function startGuardianService(): void {
  if (started) return;
  const cfg = getRuntimeConfig();
  if (!cfg.enabled) return;
  started = true;
  currentPollMs = cfg.pollMs;
  setupLocalWatchers();
  void runGithubPollTick();
  timer = setInterval(() => {
    void runGithubPollTick();
  }, cfg.pollMs);
  nextRunAt = new Date(Date.now() + cfg.pollMs).toISOString();
  console.info("[guardian] service started");
}

export function stopGuardianService(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  for (const w of watchers.splice(0, watchers.length)) {
    w.close();
  }
  for (const t of pendingLocalRuns.values()) {
    clearTimeout(t);
  }
  pendingLocalRuns.clear();
  started = false;
  nextRunAt = null;
}

export function getGuardianStatus(): {
  started: boolean;
  watchedDirs: number;
  githubRepoCount: number;
  pollMs: number;
  enabled: boolean;
  runningGithubJobs: number;
  runningLocalJobs: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastRunDurationMs: number | null;
  nextRunAt: string | null;
} {
  const cfg = getRuntimeConfig();
  return {
    started,
    watchedDirs: watchers.length,
    githubRepoCount: cfg.githubRepos.length,
    pollMs: currentPollMs,
    enabled: cfg.enabled,
    runningGithubJobs: runningGithubRuns.size,
    runningLocalJobs: runningLocalRuns.size,
    lastRunAt,
    lastSuccessAt,
    lastError,
    lastRunDurationMs,
    nextRunAt,
  };
}

export function restartGuardianService(): void {
  stopGuardianService();
  startGuardianService();
}

export async function runGuardianNow(): Promise<void> {
  await runGithubPollTick();
  const cfg = getRuntimeConfig();
  for (const dir of cfg.localWatchDirs) {
    await scanLocalDirectory(dir);
  }
}

