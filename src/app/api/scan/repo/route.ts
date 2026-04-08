import { NextResponse } from "next/server";
import fs from "fs";
import { repoScanSchema } from "@/lib/validations/api";
import { listApprovedFolderPaths } from "@/lib/approvedFolders";
import { assertPathUnderApprovedRoots } from "@/lib/security/pathGuard";
import { analyzeLocalRepo, cloneRepoToAnalysisDir } from "@/lib/services/repoScanner.service";
import { scoreFindings } from "@/lib/services/riskScorer.service";
import { persistFolderScan, persistRepoRecord } from "@/lib/services/scanPersistence.service";
import { getConfig } from "@/lib/config";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = repoScanSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const roots = listApprovedFolderPaths();
  if (!roots.length) {
    return NextResponse.json(
      { error: "Add at least one approved folder before scanning repositories." },
      { status: 400 }
    );
  }

  const cfg = getConfig();
  let localPath: string;
  let sourceRef: string;
  let sourceType: "local" | "clone";

  if (parsed.data.source.type === "local") {
    localPath = assertPathUnderApprovedRoots(parsed.data.source.path, roots);
    if (!fs.existsSync(localPath) || !fs.statSync(localPath).isDirectory()) {
      return NextResponse.json({ error: "Not a directory" }, { status: 400 });
    }
    sourceRef = localPath;
    sourceType = "local";
  } else {
    const { localPath: cloned } = cloneRepoToAnalysisDir({
      url: parsed.data.source.url,
      branch: parsed.data.source.branch,
      analysisRoot: cfg.analysisRootAbs,
    });
    localPath = cloned;
    sourceRef = parsed.data.source.url;
    sourceType = "clone";
  }

  const repoId = persistRepoRecord({
    sourceType,
    sourceRef,
    localPath,
  });

  const { findings, treeSummary } = analyzeLocalRepo(localPath);
  const risk = scoreFindings(findings);
  const { sessionId } = persistFolderScan({
    approvedFolderId: null,
    items: [],
    heuristicFindings: findings,
    risk,
    planned: [],
    sessionType: "repo",
    repositoryId: repoId,
  });

  return NextResponse.json({
    sessionId,
    repositoryId: repoId,
    localPath,
    treeSummary,
    risk,
    findingsCount: findings.length,
  });
}
