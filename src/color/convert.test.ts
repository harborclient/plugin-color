import { describe, expect, it } from "vitest";
import { formatsFromHex, normalizeHex, parseEyeDropperHex } from "./convert.js";

describe("normalizeHex", () => {
  it("normalizes six-digit hex with hash", () => {
    expect(normalizeHex("#3C3C3C")).toBe("#3C3C3C");
  });

  it("uppercases lowercase six-digit hex", () => {
    expect(normalizeHex("#3c3c3c")).toBe("#3C3C3C");
  });

  it("strips alpha from eight-digit hex", () => {
    expect(normalizeHex("#3C3C3CFF")).toBe("#3C3C3C");
  });

  it("accepts hex without a leading hash", () => {
    expect(normalizeHex("3C3C3C")).toBe("#3C3C3C");
  });

  it("expands three-digit hex", () => {
    expect(normalizeHex("#abc")).toBe("#AABBCC");
  });

  it("rejects empty and invalid hex", () => {
    expect(normalizeHex("")).toBeNull();
    expect(normalizeHex("#GGGGGG")).toBeNull();
  });
});

describe("parseEyeDropperHex", () => {
  it("returns null for non-strings and blank input", () => {
    expect(parseEyeDropperHex(null)).toBeNull();
    expect(parseEyeDropperHex(undefined)).toBeNull();
    expect(parseEyeDropperHex(42)).toBeNull();
    expect(parseEyeDropperHex("   ")).toBeNull();
  });

  it("parses eight-digit eyedropper values", () => {
    expect(parseEyeDropperHex("#3C3C3CFF")).toBe("#3C3C3C");
  });

  it("parses rgb() strings", () => {
    expect(parseEyeDropperHex("rgb(60, 60, 60)")).toBe("#3C3C3C");
    expect(parseEyeDropperHex("rgb(255 0 0)")).toBe("#FF0000");
  });

  it("parses rgba() strings and drops alpha", () => {
    expect(parseEyeDropperHex("rgba(60, 60, 60, 0.5)")).toBe("#3C3C3C");
  });

  it("returns null for out-of-range or malformed rgb", () => {
    expect(parseEyeDropperHex("rgb(300, 0, 0)")).toBeNull();
    expect(parseEyeDropperHex("hsl(0, 0%, 24%)")).toBeNull();
  });
});

describe("formatsFromHex", () => {
  it("builds screenshot formats from six-digit hex", () => {
    expect(formatsFromHex("#3C3C3C")).toEqual({
      hex: "#3C3C3C",
      rgb: "rgb(60, 60, 60)",
      hsl: "hsl(0, 0%, 24%)",
      hsv: "hsv(0, 0%, 24%)",
      cmyk: "cmyk(0%, 0%, 0%, 76%)",
      name: "Not named",
    });
  });

  it("builds the same formats from eight-digit hex with alpha", () => {
    expect(formatsFromHex("#3C3C3CFF")).toEqual({
      hex: "#3C3C3C",
      rgb: "rgb(60, 60, 60)",
      hsl: "hsl(0, 0%, 24%)",
      hsv: "hsv(0, 0%, 24%)",
      cmyk: "cmyk(0%, 0%, 0%, 76%)",
      name: "Not named",
    });
  });
});
