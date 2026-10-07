import { describe, expect, it } from "vitest";
import { canUseFaceGallery, getNextEnrollmentStage } from "./enrollment-flow";

describe("facial enrollment capture flow", () => {
  it("allows a gallery image only for the first frontal sample", () => {
    expect(canUseFaceGallery("front", 0)).toBe(true);
    expect(canUseFaceGallery("front", 1)).toBe(false);
    expect(canUseFaceGallery("left", 1)).toBe(false);
    expect(canUseFaceGallery("right", 2)).toBe(false);
    expect(canUseFaceGallery("blink", 3)).toBe(false);
  });

  it("keeps all live side and blink stages after an optional gallery frontal image", () => {
    const order = ["front", "right", "left", "blink"] as const;
    expect(getNextEnrollmentStage([...order], "front")).toBe("right");
    expect(getNextEnrollmentStage([...order], "right")).toBe("left");
    expect(getNextEnrollmentStage([...order], "left")).toBe("blink");
    expect(getNextEnrollmentStage([...order], "blink")).toBe("success");
  });
});
