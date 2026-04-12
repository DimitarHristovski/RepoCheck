import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { repoScanSchema } from "@/lib/validations/api";
import { analyzeLocalRepo, cloneRepoToAnalysisDir } from "@/lib/services/repoScanner.service";
import {
  finalizeScanSession,
  persistRepoRecord,
} from "@/lib/services/scanPersistence.service";
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
    const raw = parsed.data.source.path.trim();
    if (!raw) {
      return NextResponse.json(
        { error: "Provide an absolute path to the repository root directory." },
        { status: 400 }
      );
    }
    const resolved = path.resolve(raw);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      return NextResponse.json(
        { error: "Local path is not an existing directory" },
        { status: 400 }
      );
    }
    localPath = resolved;
    sourceRef = resolved;
    sourceType = "local";
  }

  const repoId = persistRepoRecord({
    sourceType,
    sourceRef,
    localPath,
  });

  const { findings, treeSummary } = analyzeLocalRepo(localPath);

  const { sessionId, llm } = await finalizeScanSession({
    findings,
    sessionType: "repo",
    repositoryId: repoId,
    plannedDescription:
      "Review repository static scan results and confirm before any remediation or execution.",
    plannedPayload: {
      sourceType,
      sourceRef,
      localPath,
    },
    extraSessionMetadata: {
      scanSource: "repo",
      sourceType,
      sourceRef,
      localPath,
    },
  });

  return NextResponse.json({
    sessionId,
    repositoryId: repoId,
    localPath,
    treeSummary,
    findingsCount: findings.length,
    llmRiskExplanation: llm.ok ? llm.data : undefined,
    llmRiskExplanationError: llm.ok
      ? undefined
      : { reason: llm.reason, message: llm.message },
  });
}
