import { describe, it, expect, afterEach, vi } from "vitest";
import { devicePixelRatio, cssToDevicePx, deviceToCssPx } from "../src/screen";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("screen pixel helpers", () => {
  it("falls back to a ratio of 1 outside the browser", () => {
    // No `window` in the node test environment.
    expect(devicePixelRatio()).toBe(1);
    expect(cssToDevicePx(10)).toBe(10);
    expect(deviceToCssPx(10)).toBe(10);
  });

  it("reads window.devicePixelRatio when present", () => {
    vi.stubGlobal("window", { devicePixelRatio: 3 });
    expect(devicePixelRatio()).toBe(3);
    expect(cssToDevicePx(2)).toBe(6);
    expect(deviceToCssPx(6)).toBe(2);
  });

  it("ignores an invalid ratio (0, NaN, missing)", () => {
    vi.stubGlobal("window", { devicePixelRatio: 0 });
    expect(devicePixelRatio()).toBe(1);

    vi.stubGlobal("window", { devicePixelRatio: Number.NaN });
    expect(devicePixelRatio()).toBe(1);

    vi.stubGlobal("window", {});
    expect(devicePixelRatio()).toBe(1);
  });
});
