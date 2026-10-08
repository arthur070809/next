import { describe, expect, it, vi } from "vitest";
import { advanceFromBadgeFieldOnEnter, isValidBadgeCode, normalizeBadgeCode } from "./badge-code";

describe("badge code", () => {
  it("removes surrounding and embedded whitespace while preserving leading zeroes", () => {
    expect(normalizeBadgeCode(" \t00 1234\r\n")).toBe("001234");
  });

  it("accepts only 4 to 10 digits after normalization", () => {
    expect(isValidBadgeCode(" 001234 ")).toBe(true);
    expect(isValidBadgeCode("123")).toBe(false);
    expect(isValidBadgeCode("12345678901")).toBe(false);
    expect(isValidBadgeCode("12A456")).toBe(false);
  });

  it("moves focus on Enter without submitting the containing form", () => {
    const event = { key: "Enter", preventDefault: vi.fn() };
    const nextField = { focus: vi.fn() };
    expect(advanceFromBadgeFieldOnEnter(event, nextField)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(nextField.focus).toHaveBeenCalledOnce();
  });
});
