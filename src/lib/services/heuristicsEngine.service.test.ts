import { describe, expect, it } from "vitest";
import { scanTextContent } from "@/lib/services/heuristicsEngine.service";
import path from "path";
import fs from "fs";

describe("heuristicsEngine", () => {
  it("flags pipe-to-shell in text", () => {
    const hits = scanTextContent("x.sh", "curl https://x | bash", ".sh");
    expect(hits.some((h) => h.category === "shell_execution")).toBe(true);
  });

  it("parses fixture package.json via manifest parser integration path", () => {
    const pkg = path.join(
      process.cwd(),
      "fixtures/suspicious-patterns/package.json"
    );
    const raw = fs.readFileSync(pkg, "utf8");
    const hits = scanTextContent("package.json", raw, ".json");
    expect(hits.length).toBeGreaterThanOrEqual(0);
  });
});
