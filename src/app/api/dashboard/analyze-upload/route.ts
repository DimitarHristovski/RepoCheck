import path from "path";
import { NextResponse } from "next/server";
import {
  analyzeSingleTextLikeFile,
  analyzeZipBuffer,
  mergeUploadContexts,
} from "@/lib/services/uploadScan.service";
import { finalizeScanSession } from "@/lib/services/scanPersistence.service";
import type { HeuristicFinding } from "@/lib/types/findings";

export const runtime = "nodejs";

const MAX_FILES = 6;

const ALLOWED_NONZIP = new Set([
  ".txt",
  ".md",
  ".json",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".yml",
  ".yaml",
  ".sh",
  ".ps1",
  ".bat",
  ".py",
  ".toml",
]);

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const raw = form.getAll("files");
  const files = raw.filter((x): x is File => typeof File !== "undefined" && x instanceof File);
  if (!files.length) {
    return NextResponse.json({ error: "No files uploaded (field name: files)" }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `At most ${MAX_FILES} files per request` },
      { status: 400 }
    );
  }

  const blocks: string[] = [];
  const allFindings: HeuristicFinding[] = [];
  const names: string[] = [];

  for (const file of files) {
    names.push(file.name);
    const buf = Buffer.from(await file.arrayBuffer());
    const base = path.basename(file.name);
    if (base === "Dockerfile" || base.toLowerCase() === "makefile") {
      const { contextBlock, findings } = analyzeSingleTextLikeFile(buf, file.name);
      blocks.push(contextBlock);
      allFindings.push(...findings);
      continue;
    }

    const ext = extOf(file.name);

    if (ext === ".zip") {
      const { contextBlock, findings } = analyzeZipBuffer(buf, file.name);
      blocks.push(contextBlock);
      allFindings.push(...findings);
      continue;
    }

    if (!ALLOWED_NONZIP.has(ext)) {
      return NextResponse.json(
        {
          error: `Unsupported type for ${file.name}. Use .zip or: ${[...ALLOWED_NONZIP].join(", ")}`,
        },
        { status: 400 }
      );
    }

    const { contextBlock, findings } = analyzeSingleTextLikeFile(buf, file.name);
    blocks.push(contextBlock);
    allFindings.push(...findings);
  }

  const { sessionId, llm } = await finalizeScanSession({
    findings: allFindings,
    sessionType: "upload",
    repositoryId: null,
    plannedDescription: `Review uploaded artifact scan (${names.join(", ")})`,
    plannedPayload: { uploadFileNames: names },
    extraSessionMetadata: {
      scanSource: "dashboard_upload",
      uploadFileNames: names,
    },
  });

  return NextResponse.json({
    contextBlock: mergeUploadContexts(blocks),
    fileNames: names,
    findingsCount: allFindings.length,
    sessionId,
    llmRiskExplanation: llm.ok ? llm.data : undefined,
    llmRiskExplanationError: llm.ok
      ? undefined
      : { reason: llm.reason, message: llm.message },
  });
}
