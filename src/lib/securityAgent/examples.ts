import type { SecurityAgentReport } from "./types";

/** Example structured output (illustrative shapes for tests / docs). */
export const exampleCleanReport: Pick<
  SecurityAgentReport,
  "summary" | "keyFindings" | "contextAnalysis" | "finalReasoning"
> = {
  summary: {
    verdict: "CLEAN",
    confidence: "LOW",
    totalScore: 1,
    capsApplied: [],
  },
  keyFindings: [],
  contextAnalysis: [
    {
      bucket: "expected_behavior",
      summary: "No strong correlated patterns detected in scanned files.",
      relatedPaths: [],
    },
  ],
  finalReasoning:
    "Aggregate score 1 sits in the clean band; patterns are absent or negligible.",
};

export const exampleNeedsReviewReport: Pick<
  SecurityAgentReport,
  "summary" | "keyFindings" | "combinationHits"
> = {
  summary: {
    verdict: "NEEDS_REVIEW",
    confidence: "MEDIUM",
    totalScore: 8,
    capsApplied: [],
  },
  keyFindings: [
    {
      filePath: "package.json",
      fileTrustLevel: "HIGH_PRIORITY",
      signalTypes: ["INSTALL_POSTINSTALL", "PACKAGE_SCRIPT_SHELL_CHAIN"],
      scoreContribution: 7,
      explanation: "package.json controls install lifecycle and dependencies.",
    },
    {
      filePath: "scripts/setup.sh",
      fileTrustLevel: "HIGH_PRIORITY",
      signalTypes: ["CURL_PIPE_BASH", "SHELL_STRING"],
      scoreContribution: 6,
      explanation: "scripts/ often runs in install/CI contexts.",
    },
  ],
  combinationHits: [
    {
      id: "INSTALL_HOOK_PLUS_EXECUTION",
      points: 6,
      explanation:
        "Lifecycle script hooks overlap with execution primitives or shell chains.",
      involvedFiles: ["package.json", "scripts/setup.sh"],
    },
  ],
};
