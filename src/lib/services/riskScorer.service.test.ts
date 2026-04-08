import { describe, expect, it } from "vitest";
import { scoreFindings } from "@/lib/services/riskScorer.service";
import type { HeuristicFinding } from "@/lib/types/findings";

describe("riskScorer", () => {
  it("scores empty findings as low risk", () => {
    const r = scoreFindings([]);
    expect(r.label).toBe("low_risk");
    expect(r.totalScore).toBe(0);
  });

  it("elevates label when many weighted findings", () => {
    const findings: HeuristicFinding[] = Array.from({ length: 8 }).map((_, i) => ({
      severity: "high",
      category: "install_hooks",
      title: `hook-${i}`,
      description: "test",
      evidence: {},
    }));
    const r = scoreFindings(findings);
    expect(r.totalScore).toBeGreaterThan(40);
    expect(["suspicious", "high_risk", "strongly_unsafe"]).toContain(r.label);
  });
});
