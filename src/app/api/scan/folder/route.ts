import { NextResponse } from "next/server";
import { getApprovedFolderById } from "@/lib/store/repository";
import { folderScanSchema } from "@/lib/validations/api";
import { listApprovedFolderPaths } from "@/lib/approvedFolders";
import { scanApprovedFolder } from "@/lib/services/fileScanner.service";
import { scoreFindings } from "@/lib/services/riskScorer.service";
import { buildOrganizationPlan } from "@/lib/services/organizationPlanner.service";
import { explainRisksWithLlm } from "@/lib/services/llmRiskExplain.service";
import { persistFolderScan } from "@/lib/services/scanPersistence.service";
import { mergeScanSessionMetadata } from "@/lib/store/repository";
import { getAppSettings } from "@/lib/settingsStore";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = folderScanSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const folder = getApprovedFolderById(parsed.data.approvedFolderId);
  if (!folder) {
    return NextResponse.json({ error: "Unknown approved folder" }, { status: 404 });
  }
  const roots = listApprovedFolderPaths();
  const appSettings = getAppSettings();
  const { items, findings, errors } = scanApprovedFolder({
    rootPath: folder.path,
    approvedRoots: roots,
    maxDepth: parsed.data.maxDepth ?? appSettings.scanDepth,
    ignorePatterns: appSettings.ignorePatterns,
  });
  const risk = scoreFindings(findings);
  const planned = buildOrganizationPlan(items);
  const { sessionId } = persistFolderScan({
    approvedFolderId: folder.id,
    items,
    heuristicFindings: findings,
    risk,
    planned,
    sessionType: "folder",
  });

  const llm = await explainRisksWithLlm({
    findings,
    risk,
    scanKind: "folder",
  });
  mergeScanSessionMetadata(sessionId, {
    llmRiskExplanation: llm.ok ? llm.data : null,
    llmRiskExplanationMeta: llm.ok
      ? null
      : { reason: llm.reason, message: llm.message },
  });

  const categoryCounts = items.reduce<Record<string, number>>((acc, it) => {
    acc[it.category] = (acc[it.category] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    sessionId,
    stats: {
      fileCount: items.length,
      findingsCount: findings.length,
      plannedActions: planned.length,
      categoryCounts,
    },
    risk,
    errors,
    llmRiskExplanation: llm.ok ? llm.data : undefined,
    llmRiskExplanationError: llm.ok
      ? undefined
      : { reason: llm.reason, message: llm.message },
  });
}
