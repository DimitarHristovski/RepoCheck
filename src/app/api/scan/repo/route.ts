import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { repoScanSchema } from "@/lib/validations/api";
import { analyzeLocalRepo } from "@/lib/services/repoScanner.service";
import {
  downloadPublicGithubRepoArchive,
  fetchGithubDefaultBranch,
} from "@/lib/services/githubPublicArchive.service";
import {
  finalizeScanSession,
  persistRepoRecord,
} from "@/lib/services/scanPersistence.service";
import { getConfig } from "@/lib/config";
import {
  isValidCloneHttpUrl,
  normalizeGithubRepoUrl,
  parseGithubOwnerRepoFromWebUrl,
} from "@/lib/gitHubCloneUrl";

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
  let sourceType: "local" | "archive";

  if (parsed.data.source.type === "url") {
    const normalized = normalizeGithubRepoUrl(parsed.data.source.url);
    if (!isValidCloneHttpUrl(normalized)) {
      return NextResponse.json(
        {
          error:
            "Invalid URL. Use https://github.com/owner/repo, owner/repo, or git@github.com:owner/repo (public only).",
        },
        { status: 400 }
      );
    }

    const gh = parseGithubOwnerRepoFromWebUrl(normalized);
    if (!gh) {
      return NextResponse.json(
        {
          error:
            "Only public github.com repositories are supported. Do not put tokens or passwords in the URL.",
        },
        { status: 400 }
      );
    }

    const branchInput = parsed.data.source.branch?.trim();
    let branch: string;
    try {
      branch =
        branchInput ?? (await fetchGithubDefaultBranch(gh.owner, gh.repo));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    try {
      const { localPath: extracted } = await downloadPublicGithubRepoArchive({
        owner: gh.owner,
        repo: gh.repo,
        branch,
        analysisRoot: cfg.analysisRootAbs,
      });
      localPath = extracted;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    sourceRef = `https://github.com/${gh.owner}/${gh.repo}`;
    sourceType = "archive";
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
