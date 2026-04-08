import { describe, expect, it } from "vitest";
import { folderScanSchema } from "@/lib/validations/api";

describe("folderScan API validation", () => {
  it("accepts uuid folder id", () => {
    const id = "123e4567-e89b-12d3-a456-426614174000";
    const p = folderScanSchema.safeParse({ approvedFolderId: id });
    expect(p.success).toBe(true);
  });
});
