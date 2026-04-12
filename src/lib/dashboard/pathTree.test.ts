import { describe, expect, it } from "vitest";
import { buildPathTreeFromHints, worstSeverityInSubtree } from "./pathTree";
import type { CopilotRiskPathHint } from "@/lib/store/repository";

describe("buildPathTreeFromHints", () => {
  it("groups paths and keeps worst severity", () => {
    const hints: CopilotRiskPathHint[] = [
      { path: "src/a.ts", severity: "medium" },
      { path: "src/a.ts", severity: "high" },
      { path: "src/b.ts", severity: "critical" },
    ];
    const root = buildPathTreeFromHints(hints);
    const src = root.children.get("src")!;
    expect(src.children.get("a.ts")?.severity).toBe("high");
    expect(src.children.get("b.ts")?.severity).toBe("critical");
    expect(worstSeverityInSubtree(src)).toBe("critical");
  });
});
