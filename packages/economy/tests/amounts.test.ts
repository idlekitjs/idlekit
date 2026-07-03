import { describe, expect, it } from "vitest";
import {
  collectAmounts,
  EconomyError,
  mergeAmounts,
  normalizeAmounts,
  scaleAmounts,
} from "../src";

describe("normalizeAmounts", () => {
  it("accepts tuples and objects, mixed", () => {
    expect(
      normalizeAmounts([
        ["currency:gold", 5],
        { resourceId: "currency:science", amount: 2 },
      ]),
    ).toEqual([
      { resourceId: "currency:gold", amount: 5 },
      { resourceId: "currency:science", amount: 2 },
    ]);
  });

  it("merges duplicates by sum, keeping first-seen order", () => {
    expect(
      normalizeAmounts([
        ["currency:gold", 5],
        ["currency:science", 1],
        ["currency:gold", 3],
      ]),
    ).toEqual([
      { resourceId: "currency:gold", amount: 8 },
      { resourceId: "currency:science", amount: 1 },
    ]);
  });

  it("filters zero lines silently", () => {
    expect(normalizeAmounts([["currency:gold", 0]])).toEqual([]);
    // Duplicates that cancel to zero are dropped too.
    expect(
      normalizeAmounts([
        ["currency:gold", 0],
        ["currency:gold", 0],
      ]),
    ).toEqual([]);
  });

  it("throws on negative, NaN and Infinity amounts", () => {
    expect(() => normalizeAmounts([["currency:gold", -1]])).toThrow(EconomyError);
    expect(() => normalizeAmounts([["currency:gold", NaN]])).toThrow(EconomyError);
    expect(() => normalizeAmounts([["currency:gold", Infinity]])).toThrow(EconomyError);
  });
});

describe("collectAmounts", () => {
  it("reports invalid lines instead of throwing", () => {
    const { amounts, invalid } = collectAmounts([
      ["currency:gold", 5],
      ["currency:science", -2],
      ["currency:mana", NaN],
    ]);
    expect(amounts).toEqual([{ resourceId: "currency:gold", amount: 5 }]);
    expect(invalid).toEqual([
      { resourceId: "currency:science", amount: -2 },
      { resourceId: "currency:mana", amount: NaN },
    ]);
  });
});

describe("mergeAmounts", () => {
  it("merges several lists into one normalized list", () => {
    expect(
      mergeAmounts(
        [["currency:gold", 5]],
        [
          ["currency:gold", 2],
          ["currency:science", 1],
        ],
      ),
    ).toEqual([
      { resourceId: "currency:gold", amount: 7 },
      { resourceId: "currency:science", amount: 1 },
    ]);
  });
});

describe("scaleAmounts", () => {
  it("scales every line", () => {
    expect(scaleAmounts([["currency:gold", 5]], 3)).toEqual([
      { resourceId: "currency:gold", amount: 15 },
    ]);
  });

  it("scaling by zero yields an empty list", () => {
    expect(scaleAmounts([["currency:gold", 5]], 0)).toEqual([]);
  });

  it("rejects negative or non-finite factors", () => {
    expect(() => scaleAmounts([["currency:gold", 5]], -1)).toThrow(EconomyError);
    expect(() => scaleAmounts([["currency:gold", 5]], Infinity)).toThrow(EconomyError);
  });
});
