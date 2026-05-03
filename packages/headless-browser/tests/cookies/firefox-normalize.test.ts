import { describe, expect, it } from "vite-plus/test";
import { normalizeFirefoxExpiry } from "../../src/cookies/utils/firefox-normalize";

describe("normalizeFirefoxExpiry", () => {
  it("passes through a Unix-seconds timestamp unchanged", () => {
    // 2027-01-01T00:00:00Z — well in the future
    const futureSeconds = 1_798_761_600;
    expect(normalizeFirefoxExpiry(futureSeconds)).toBe(futureSeconds);
  });

  it("does NOT divide by 1000 (regression: Firefox stores seconds, not milliseconds)", () => {
    // The pre-fix bug divided this by 1000 and returned 1_809_356 (year 1970),
    // so every Firefox cookie appeared expired. After the fix the value is
    // returned as-is.
    const futureSeconds = 1_809_356_755;
    expect(normalizeFirefoxExpiry(futureSeconds)).toBe(futureSeconds);
  });

  it("accepts bigint values (libsql sometimes returns INTEGER as bigint)", () => {
    const futureSeconds = 1_798_761_600;
    expect(normalizeFirefoxExpiry(BigInt(futureSeconds))).toBe(futureSeconds);
  });

  it("accepts string values (defensive against driver coercion)", () => {
    expect(normalizeFirefoxExpiry("1798761600")).toBe(1_798_761_600);
  });

  it("returns undefined for undefined input", () => {
    expect(normalizeFirefoxExpiry(undefined)).toBeUndefined();
  });

  it("returns undefined for zero or negative timestamps", () => {
    expect(normalizeFirefoxExpiry(0)).toBeUndefined();
    expect(normalizeFirefoxExpiry(-1)).toBeUndefined();
  });

  it("returns undefined for non-finite numbers", () => {
    expect(normalizeFirefoxExpiry(Number.NaN)).toBeUndefined();
    expect(normalizeFirefoxExpiry(Number.POSITIVE_INFINITY)).toBeUndefined();
  });

  it("returns undefined for unparseable strings", () => {
    expect(normalizeFirefoxExpiry("not-a-number")).toBeUndefined();
  });

  it("clamps wildly out-of-range values to undefined (corrupted DBs)", () => {
    // Year ≈ 11000+ — well past JS Date's reasonable handling
    expect(normalizeFirefoxExpiry(300_000_000_000)).toBeUndefined();
  });

  it("floors fractional second values (defensive against decimal coercion)", () => {
    expect(normalizeFirefoxExpiry(1_798_761_600.9)).toBe(1_798_761_600);
  });
});
