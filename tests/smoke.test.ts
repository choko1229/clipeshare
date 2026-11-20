import { describe, expect, it } from "vitest";
import { detectMediaKind } from "@/lib/uploads/file-kind";

describe("test harness", () => {
  it("resolves the @ alias", () => {
    expect(detectMediaKind({ name: "a.png" })).toBe("SCREENSHOT");
  });
});
