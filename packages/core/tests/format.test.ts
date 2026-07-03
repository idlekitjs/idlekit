import { describe, it, expect } from "vitest";
import { formatNumber, formatInteger, formatDuration } from "../src/format";

describe("formatNumber", () => {
  it("keeps small integers as-is", () => {
    expect(formatNumber(42)).toBe("42");
  });

  it("applies suffixes beyond a thousand", () => {
    expect(formatNumber(1500)).toBe("1.50K");
    expect(formatNumber(2_500_000)).toBe("2.50M");
    expect(formatNumber(3_000_000_000)).toBe("3.00B");
  });

  it("falls back to scientific notation for very large numbers", () => {
    expect(formatNumber(1e40)).toContain("e+");
  });

  it("handles infinity", () => {
    expect(formatNumber(Infinity)).toBe("Infinity");
    expect(formatNumber(-Infinity)).toBe("-Infinity");
  });

  it("handles NaN", () => {
    expect(formatNumber(NaN)).toBe("NaN");
  });
});

describe("formatInteger", () => {
  it("adds thousands separators", () => {
    expect(formatInteger(1234567)).toBe("1,234,567");
  });
});

describe("formatDuration", () => {
  it("formats minutes and seconds", () => {
    expect(formatDuration(90_000)).toBe("1m 30s");
  });

  it("shows 0s for a zero duration", () => {
    expect(formatDuration(0)).toBe("0s");
  });

  it("formats days and hours", () => {
    expect(formatDuration(90_000_000)).toBe("1d 1h");
  });
});
