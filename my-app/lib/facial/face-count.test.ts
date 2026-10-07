import { describe, expect, it } from "vitest";
import { inspectFaceCount } from "./face-count";

describe("facial enrollment face count", () => {
  it("rejects an empty detection result with a clear message", () => {
    expect(inspectFaceCount([])).toEqual({
      face: null,
      message: "Nenhum rosto detectado. Posicione o rosto na oval",
    });
  });

  it("rejects multiple detected faces with a clear message", () => {
    expect(inspectFaceCount([{ id: 1 }, { id: 2 }])).toEqual({
      face: null,
      message: "Mais de um rosto na câmera",
    });
  });

  it("returns the sole detected face", () => {
    const face = { id: 1 };
    expect(inspectFaceCount([face])).toEqual({ face, message: null });
  });
});
