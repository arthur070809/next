import { describe, expect, it } from "vitest";
import {
  DESCRIPTION_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH_ERROR,
  limitRequisitionDescriptionInput,
  normalizeRequisitionDescription,
} from "./requisition-description";

describe("requisition description length", () => {
  it("accepts exactly the configured number of characters and rejects one more after trimming", () => {
    expect(Array.from(normalizeRequisitionDescription(` ${"x".repeat(DESCRIPTION_MAX_LENGTH)} `)).length)
      .toBe(DESCRIPTION_MAX_LENGTH);
    expect(Array.from(normalizeRequisitionDescription(`${"x".repeat(DESCRIPTION_MAX_LENGTH + 1)}   `)).length)
      .toBeGreaterThan(DESCRIPTION_MAX_LENGTH);
  });

  it("counts emoji as one Unicode code point and caps input without splitting one", () => {
    const emoji = "😀";
    const accepted = `${emoji}`.repeat(DESCRIPTION_MAX_LENGTH);
    const clipped = limitRequisitionDescriptionInput(`${accepted}${emoji}`);

    expect(Array.from(clipped)).toHaveLength(DESCRIPTION_MAX_LENGTH);
    expect(clipped).toBe(accepted);
  });

  it("replaces line breaks with spaces and trims the ends", () => {
    expect(normalizeRequisitionDescription("  linha 1\r\nlinha 2  ")).toBe("linha 1 linha 2");
    expect(limitRequisitionDescriptionInput("linha 1\nlinha 2")).toBe("linha 1 linha 2");
  });

  it("shares one limit and localized validation message", () => {
    expect(DESCRIPTION_MAX_LENGTH).toBe(50);
    expect(DESCRIPTION_MAX_LENGTH_ERROR).toBe("A descrição deve ter no máximo 50 caracteres.");
  });
});
