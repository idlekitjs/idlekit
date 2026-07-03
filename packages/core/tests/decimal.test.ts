import { describe, it, expect } from "vitest";
import { Decimal, D } from "../src/numbers";

describe("Decimal construction & toNumber", () => {
  it("builds from numbers", () => {
    expect(D(0).toNumber()).toBe(0);
    expect(D(5).toNumber()).toBe(5);
    expect(D(-3).toNumber()).toBe(-3);
    expect(D(1.5).toNumber()).toBe(1.5);
    expect(D(0.1).toNumber()).toBeCloseTo(0.1, 12);
  });

  it("normalizes the mantissa into [1, 10)", () => {
    const d = D(12345);
    expect(d.mantissa).toBeCloseTo(1.2345, 10);
    expect(d.exponent).toBe(4);
    expect(d.toNumber()).toBe(12345);
  });

  it("builds from strings, including huge exponents", () => {
    expect(D("12345").toNumber()).toBe(12345);
    expect(D("-2.5e-3").toNumber()).toBeCloseTo(-0.0025, 12);
    const big = D("1.23e45");
    expect(big.mantissa).toBeCloseTo(1.23, 10);
    expect(big.exponent).toBe(45);
    expect(D("1e1000").log10()).toBeCloseTo(1000, 6);
  });

  it("treats a Decimal source as a copy", () => {
    const a = D("1.5e600");
    expect(D(a).eq(a)).toBe(true);
  });
});

describe("Decimal arithmetic", () => {
  it("adds", () => {
    expect(D(2).add(3).toNumber()).toBe(5);
    expect(D(0.1).add(0.2).toNumber()).toBeCloseTo(0.3, 12);
  });

  it("drops a negligible operand in addition", () => {
    expect(D(1e100).add(1).toNumber()).toBe(1e100);
    expect(D(1).add(1e100).toNumber()).toBe(1e100);
  });

  it("subtracts", () => {
    expect(D(5).sub(3).toNumber()).toBe(2);
    expect(D(3).sub(5).toNumber()).toBe(-2);
    expect(D(5).sub(5).isZero()).toBe(true);
  });

  it("multiplies, including beyond Number range", () => {
    expect(D(2).mul(3).toNumber()).toBe(6);
    expect(D(1e50).mul(1e50).log10()).toBeCloseTo(100, 6);
    const huge = D("1.5e300").mul("1e300");
    expect(huge.log10()).toBeCloseTo(600.176, 3);
    expect(huge.toNumber()).toBe(Infinity); // overflows Number, but stays a finite Decimal
    expect(huge.isFinite()).toBe(true);
  });

  it("divides", () => {
    expect(D(6).div(2).toNumber()).toBe(3);
    expect(D(1).div(3).toNumber()).toBeCloseTo(1 / 3, 12);
    expect(D("1e100").div("1e50").log10()).toBeCloseTo(50, 6);
  });

  it("negates, takes abs and reciprocal", () => {
    expect(D(5).neg().toNumber()).toBe(-5);
    expect(D(-5).abs().toNumber()).toBe(5);
    expect(D(2).recip().toNumber()).toBe(0.5);
  });
});

describe("Decimal pow & log", () => {
  it("raises to an integer power exactly", () => {
    expect(D(2).pow(10).toNumber()).toBe(1024);
    expect(D(10).pow(3).toNumber()).toBe(1000);
    expect(D(2).pow(0).toNumber()).toBe(1);
    expect(D(2).pow(-1).toNumber()).toBe(0.5);
  });

  it("raises to a huge integer power", () => {
    expect(D(2).pow(1000).log10()).toBeCloseTo(301.03, 2);
  });

  it("raises to a fractional power", () => {
    expect(D(9).pow(0.5).toNumber()).toBeCloseTo(3, 9);
  });

  it("computes log10", () => {
    expect(D(100).log10()).toBe(2);
    expect(D(1000).log10()).toBe(3);
    expect(D("1e1000").log10()).toBeCloseTo(1000, 6);
  });
});

describe("Decimal comparison", () => {
  it("compares with Decimals and numbers", () => {
    expect(D(5).gt(3)).toBe(true);
    expect(D(5).lt(3)).toBe(false);
    expect(D(5).gte(5)).toBe(true);
    expect(D(5).lte(5)).toBe(true);
    expect(D(2).eq(D(2))).toBe(true);
    expect(D(1e100).gt(1e50)).toBe(true);
  });

  it("handles signs", () => {
    expect(D(-5).lt(0)).toBe(true);
    expect(D(-5).lt(-3)).toBe(true);
    expect(D(-1e100).lt(-1e50)).toBe(true);
  });

  it("provides min and max", () => {
    expect(Decimal.max(D(2), D(5)).toNumber()).toBe(5);
    expect(Decimal.min(D(2), D(5)).toNumber()).toBe(2);
    expect(D(2).max(5).toNumber()).toBe(5);
  });
});

describe("Decimal rounding", () => {
  it("floors, ceils, rounds and truncates", () => {
    expect(D(2.7).floor().toNumber()).toBe(2);
    expect(D(2.3).ceil().toNumber()).toBe(3);
    expect(D(2.5).round().toNumber()).toBe(3);
    expect(D(2.7).trunc().toNumber()).toBe(2);
    expect(D(-2.3).floor().toNumber()).toBe(-3);
    expect(D(-2.7).trunc().toNumber()).toBe(-2);
  });

  it("leaves already-integer huge values untouched", () => {
    const big = D("1e100");
    expect(big.floor().eq(big)).toBe(true);
  });
});

describe("Decimal formatting & serialization", () => {
  it("formats small values plainly", () => {
    expect(D(12345).toString()).toBe("12345");
    expect(D(1.5).toString()).toBe("1.5");
    expect(D(0).toString()).toBe("0");
  });

  it("uses exponential notation for large values", () => {
    expect(D("1e30").toString()).toContain("e+");
    expect(D(12345).toExponential(2)).toBe("1.23e+4");
    expect(D(1.5).toFixed(2)).toBe("1.50");
  });

  it("round-trips through toJSON / D()", () => {
    const d = D("1.5e600");
    const restored = D(d.toJSON());
    expect(restored.toExponential(3)).toBe(d.toExponential(3));
  });
});

describe("Decimal predicates", () => {
  it("reports zero, sign and finiteness", () => {
    expect(D(0).isZero()).toBe(true);
    expect(D(5).isZero()).toBe(false);
    expect(D(-5).isNegative()).toBe(true);
    expect(D(5).isPositive()).toBe(true);
    expect(D(5).isFinite()).toBe(true);
  });
});
