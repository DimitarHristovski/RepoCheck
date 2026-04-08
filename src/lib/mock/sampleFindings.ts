import type { HeuristicFinding } from "@/lib/types/findings";

/** Harmless fixture strings for UI/tests — patterns resemble red flags without being executable payloads. */
export const sampleMockFindings: HeuristicFinding[] = [
  {
    severity: "high",
    category: "install_hooks",
    title: 'npm script: postinstall (fixture)',
    description:
      "Example: a postinstall script was detected in a scanned manifest. In real scans, review the exact command before npm install.",
    evidence: { script: "postinstall", commandPreview: "node scripts/hello.js" },
    filePath: "fixtures/suspicious-patterns/package.json",
  },
  {
    severity: "medium",
    category: "shell_execution",
    title: "Possible pipe-to-shell pattern (fixture)",
    description:
      "Example finding: text matched a curl|sh style pattern. Verify context — some docs use this in fenced examples.",
    evidence: { pattern: "curl|sh", path: "fixtures/suspicious-patterns/install.sh" },
    filePath: "fixtures/suspicious-patterns/install.sh",
  },
  {
    severity: "low",
    category: "duplicate_system_name",
    title: "Duplicate content (hash match) (fixture)",
    description: "Two files shared the same hash in the fixture tree.",
    evidence: { paths: ["a/copy.txt", "b/copy.txt"] },
  },
];
