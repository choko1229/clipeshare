import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { describeError, logApi } from "@/lib/api/log";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("structured API log", () => {
  it("drops secret-looking keys and keeps error codes", () => {
    const lines: string[] = [];
    vi.spyOn(console, "info").mockImplementation((line: unknown) => {
      lines.push(String(line));
    });
    logApi("info", {
      event: "test",
      code: "INVALID_REQUEST",
      token: "csq_secret",
      authorization: "Bearer csq_secret",
      deleteToken: "abc",
      csrfToken: "def",
      tokenId: "tok-1",
    });
    const parsed = JSON.parse(lines[0]) as Record<string, unknown>;
    expect(parsed).toMatchObject({ event: "test", code: "INVALID_REQUEST", tokenId: "tok-1", level: "info" });
    expect(lines[0]).not.toContain("csq_secret");
    expect(lines[0]).not.toContain("abc");
    expect(lines[0]).not.toContain("def");
  });

  it("drops an authorization code passed under the code key", () => {
    const lines: string[] = [];
    vi.spyOn(console, "warn").mockImplementation((line: unknown) => {
      lines.push(String(line));
    });
    logApi("warn", { event: "test", code: "q2Xb_fakeAuthorizationCodeValue1234567890abc" });
    expect(lines[0]).not.toContain("q2Xb_fake");
  });

  it("reduces Prisma errors to name and code (their messages can echo query arguments)", () => {
    const error = new Prisma.PrismaClientKnownRequestError("Invalid `prisma.apiToken.findUnique()` invocation: { where: { tokenHash: \"deadbeef\" } }", {
      code: "P2025",
      clientVersion: "test",
    });
    expect(describeError(error)).toBe("PrismaClientKnownRequestError(P2025)");
  });

  it("keeps only the first line of other errors", () => {
    expect(describeError(new Error("first line\nsecond line with details"))).toBe("Error: first line");
    expect(describeError("string")).toBe("non-error thrown");
  });
});
