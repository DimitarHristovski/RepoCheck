import { describe, expect, it } from "vitest";
import path from "path";
import { parsePackageJson } from "@/lib/services/manifestParser.service";

describe("manifestParser", () => {
  it("flags postinstall in fixture package.json", () => {
    const abs = path.join(
      process.cwd(),
      "fixtures/suspicious-patterns/package.json"
    );
    const hits = parsePackageJson(abs, "package.json");
    expect(hits.some((h) => h.category === "install_hooks")).toBe(true);
  });
});
