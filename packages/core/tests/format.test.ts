import { describe, it, expect } from "vitest";
import { formatNumber, formatInteger, formatDuration, parseNumber, SUFFIXES } from "../src/format";

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

describe("SUFFIXES", () => {
  it("is the idle-standard tier list, units first", () => {
    expect(SUFFIXES[0]).toBe("");
    expect(SUFFIXES[1]).toBe("K");
    expect(SUFFIXES).toContain("Qi");
    expect(SUFFIXES[SUFFIXES.length - 1]).toBe("Dc");
  });
});

describe("parseNumber", () => {
  it("parses plain integers", () => {
    expect(parseNumber("123")).toBe(123);
  });

  it("parses decimals", () => {
    expect(parseNumber("1.5")).toBe(1.5);
  });

  it("parses scientific notation", () => {
    expect(parseNumber("1.5e19")).toBe(1.5e19);
    expect(parseNumber("1.5E19")).toBe(1.5e19);
  });

  it("parses compact suffix notation", () => {
    expect(parseNumber("1K")).toBe(1_000);
    expect(parseNumber("2.5M")).toBe(2_500_000);
    expect(parseNumber("15Qi")).toBe(15 * 1e18);
  });

  it("handles every suffix tier", () => {
    SUFFIXES.forEach((suffix, tier) => {
      const text = suffix === "" ? "3" : `3${suffix}`;
      expect(parseNumber(text)).toBe(3 * Math.pow(1000, tier));
    });
  });

  it("trims surrounding whitespace", () => {
    expect(parseNumber("  2.5M  ")).toBe(2_500_000);
  });

  it("is case-sensitive to the suffix table", () => {
    expect(() => parseNumber("1k")).toThrow();
    expect(() => parseNumber("15qi")).toThrow();
  });

  it("rejects an unknown suffix", () => {
    expect(() => parseNumber("5X")).toThrow(/unknown suffix/);
  });

  it("rejects an invalid string", () => {
    expect(() => parseNumber("abc")).toThrow();
    expect(() => parseNumber("")).toThrow();
    expect(() => parseNumber("   ")).toThrow();
  });

  it("round-trips values formatted by formatNumber", () => {
    expect(parseNumber(formatNumber(1500))).toBe(1500);
    expect(parseNumber(formatNumber(2_500_000))).toBe(2_500_000);
    expect(parseNumber(formatNumber(3_000_000_000))).toBe(3_000_000_000);
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
