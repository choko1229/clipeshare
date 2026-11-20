import { describe, expect, it } from "vitest";
import { exceedsSizeLimit, resolveQuickShareSizeLimits } from "@/lib/quick-share/limits";
import { nextQuickShareDayReset, startOfQuickShareDay } from "@/lib/quick-share/rate-limit";
import { quickShareDefaults } from "@/lib/quick-share/settings";

const settings = { maxImageBytes: 50_000_000, maxVideoBytes: 200_000_000 };

describe("resolveQuickShareSizeLimits", () => {
  it("uses site settings for anonymous users", () => {
    expect(resolveQuickShareSizeLimits(null, settings)).toEqual({ imageMaxBytes: 50_000_000, videoMaxBytes: 200_000_000 });
  });

  it("falls back to site settings when the level has no value (NULL)", () => {
    expect(
      resolveQuickShareSizeLimits({ quickShareImageMaxBytes: null, quickShareVideoMaxBytes: null }, settings),
    ).toEqual({ imageMaxBytes: 50_000_000, videoMaxBytes: 200_000_000 });
  });

  it("uses level values, keeping 0 as unlimited", () => {
    expect(
      resolveQuickShareSizeLimits({ quickShareImageMaxBytes: 0, quickShareVideoMaxBytes: 500_000_000 }, settings),
    ).toEqual({ imageMaxBytes: 0, videoMaxBytes: 500_000_000 });
  });

  it("ignores corrupt negative level values", () => {
    expect(resolveQuickShareSizeLimits({ quickShareImageMaxBytes: -1, quickShareVideoMaxBytes: null }, settings).imageMaxBytes).toBe(
      50_000_000,
    );
  });
});

describe("exceedsSizeLimit", () => {
  it("accepts exactly the limit and rejects limit + 1 byte", () => {
    expect(exceedsSizeLimit(50_000_000, 50_000_000)).toBe(false);
    expect(exceedsSizeLimit(50_000_001, 50_000_000)).toBe(true);
  });

  it("treats 0 as unlimited", () => {
    expect(exceedsSizeLimit(Number.MAX_SAFE_INTEGER, 0)).toBe(false);
  });
});

describe("quick share defaults", () => {
  it("raises the default image limit to 50MB and keeps the others", () => {
    expect(quickShareDefaults).toEqual({
      maxImageBytes: 50_000_000,
      maxVideoBytes: 200_000_000,
      retentionHours: 24,
      anonymousDailyLimit: 5,
    });
  });
});

describe("daily reset boundary (same as the existing /qick counting)", () => {
  it("starts the day at local midnight", () => {
    const now = new Date(2026, 10, 21, 23, 59, 59, 999);
    expect(startOfQuickShareDay(now)).toEqual(new Date(2026, 10, 21, 0, 0, 0, 0));
    expect(nextQuickShareDayReset(now)).toEqual(new Date(2026, 10, 22, 0, 0, 0, 0));
  });

  it("moves to the next day exactly at midnight", () => {
    const midnight = new Date(2026, 10, 22, 0, 0, 0, 0);
    expect(startOfQuickShareDay(midnight)).toEqual(midnight);
    expect(nextQuickShareDayReset(midnight)).toEqual(new Date(2026, 10, 23, 0, 0, 0, 0));
  });
});
