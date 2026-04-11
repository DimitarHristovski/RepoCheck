import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { repoScanSchema } from "@/lib/validations/api";
import { listApprovedFolderPaths } from "@/lib/approvedFolders";
import { assertPathUnderApprovedRoots } from "@/lib/security/pathGuard";
import { analyzeLocalRepo, cloneRepoToAnalysisDir } from "@/lib/services/repoScanner.service";
import { scoreFindings } from "@/lib/services/riskScorer.service";
import { explainRisksWithLlm } from "@/lib/services/llmRiskExplain.service";
import { persistFolderScan, persistRepoRecord } from "@/lib/services/scanPersistence.service";
import { getApprovedFolderById, mergeScanSessionMetadata } from "@/lib/store/repository";
import { getConfig } from "@/lib/config";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = repoScanSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const cfg = getConfig();
  let localPath: string;
  let sourceRef: string;
  let sourceType: "local" | "clone";

  if (parsed.data.source.type === "url") {
    const { localPath: cloned } = cloneRepoToAnalysisDir({
      url: parsed.data.source.url,
      branch: parsed.data.source.branch,
      analysisRoot: cfg.analysisRootAbs,
    });
    localPath = cloned;
    sourceRef = parsed.data.source.url;
    sourceType = "clone";
  } else {
    const roots = listApprovedFolderPaths();
    if (!roots.length) {
      return NextResponse.json(
        {
          error:
            "Add at least one approved folder in Folder Scanner before analyzing a local repository path.",
        },
        { status: 400 }
      );
    }

    const loc = parsed.data.source;
    if ("path" in loc && loc.path) {
      localPath = assertPathUnderApprovedRoots(loc.path, roots);
    } else if ("approvedFolderId" in loc) {
      const folder = getApprovedFolderById(loc.approvedFolderId);
      if (!folder) {
        return NextResponse.json({ error: "Unknown approved folder" }, { status: 404 });
      }
      const rel = (loc.relativePath ?? ".").trim() || ".";
      const joined = path.resolve(folder.path, rel);
      localPath = assertPathUnderApprovedRoots(joined, roots);
    } else {
      return NextResponse.json({ error: "Invalid local repository source" }, { status: 400 });
    }

    if (!fs.existsSync(localPath) || !fs.statSync(localPath).isDirectory()) {
      return NextResponse.json(
        { error: "Resolved path is not a directory" },
        { status: 400 }
      );
    }
    sourceRef = localPath;
    sourceType = "local";
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

  const llm = await explainRisksWithLlm({
    findings,
    risk,
    scanKind: "repo",
  });
  mergeScanSessionMetadata(sessionId, {
    llmRiskExplanation: llm.ok ? llm.data : null,
    llmRiskExplanationMeta: llm.ok
      ? null
      : { reason: llm.reason, message: llm.message },
  });

  return NextResponse.json({
    sessionId,
    repositoryId: repoId,
    localPath,
    treeSummary,
    risk,
    findingsCount: findings.length,
    llmRiskExplanation: llm.ok ? llm.data : undefined,
    llmRiskExplanationError: llm.ok
      ? undefined
      : { reason: llm.reason, message: llm.message },
  });
}
