import { describe, it, expect } from "vitest";
import { clamp, finiteOr, positiveOr } from "../src";

describe("clamp", () => {
  it("constrains a value to the [min, max] range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe("finiteOr", () => {
  it("returns the value when finite, the fallback otherwise", () => {
    expect(finiteOr(3.5, 0)).toBe(3.5);
    expect(finiteOr(0, 9)).toBe(0);
    expect(finiteOr(-2, 9)).toBe(-2);
    expect(finiteOr(NaN, 9)).toBe(9);
    expect(finiteOr(Infinity, 9)).toBe(9);
    expect(finiteOr(-Infinity, 9)).toBe(9);
  });
});

describe("positiveOr", () => {
  it("returns the value only when it is a finite number > 0", () => {
    expect(positiveOr(4, 1)).toBe(4);
    expect(positiveOr(0, 1)).toBe(1);
    expect(positiveOr(-5, 1)).toBe(1);
    expect(positiveOr(NaN, 1)).toBe(1);
    expect(positiveOr(Infinity, 1)).toBe(1);
  });
});
