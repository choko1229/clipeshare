import { describe, expect, it } from "vitest";
import { formatMegabytes, parseMegabytes } from "@/lib/format/megabytes";
import { isSystemError } from "@/lib/quick-share/api-upload";

describe("exact MB conversion for the admin screens (no silent rounding)", () => {
  it.each([
    [50_000_000, "50"],
    [20_971_520, "20.97152"],
    [400_000, "0.4"],
    [0, "0"],
  ])("formats %s bytes as %s MB and parses it back exactly", (bytes, mb) => {
    expect(formatMegabytes(bytes)).toBe(mb);
    expect(parseMegabytes(mb)).toBe(BigInt(bytes));
  });

  it("formats bigint values", () => {
    expect(formatMegabytes(200_000_000n)).toBe("200");
  });

  it.each(["-1", "1.1234567", "abc", "", "1e3"])("rejects %s", (value) => {
    expect(parseMegabytes(value)).toBeNull();
  });
});

describe("image failures caused by the server are not reported as 415", () => {
  it("detects Node system errors (disk full etc.)", () => {
    expect(isSystemError(Object.assign(new Error("no space"), { code: "ENOSPC", errno: -28, syscall: "write" }))).toBe(true);
    expect(isSystemError(Object.assign(new Error("denied"), { code: "EACCES", errno: -13 }))).toBe(true);
  });

  it("treats decoder errors as unsupported media", () => {
    expect(isSystemError(new Error("Input buffer contains unsupported image format"))).toBe(false);
  });
});
