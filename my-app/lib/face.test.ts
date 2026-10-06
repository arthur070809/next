import { afterEach, describe, expect, it } from "vitest";
import {
  analyzeEnrollmentEmbeddings,
  decryptEmbedding,
  encryptEmbedding,
  faceEnrollmentConsistencyDistance,
  faceEnrollmentDuplicateDistance,
  faceMatchThresholdDefault,
} from "./face";
import { faceCaptureQuality } from "./facial/config";

function vector(value: number, length = 64) {
  return Array.from({ length }, (_, index) => value + index / 1000);
}

describe("facial enrollment embedding policy", () => {
  const previousEncryptionKey = process.env.FACE_EMBEDDING_ENCRYPTION_KEY;

  afterEach(() => {
    if (previousEncryptionKey === undefined) delete process.env.FACE_EMBEDDING_ENCRYPTION_KEY;
    else process.env.FACE_EMBEDDING_ENCRYPTION_KEY = previousEncryptionKey;
  });

  it("keeps the documented enrollment and provider match thresholds centralized", () => {
    expect(faceEnrollmentConsistencyDistance).toBe(0.35);
    expect(faceEnrollmentDuplicateDistance).toBe(0.42);
    expect(faceMatchThresholdDefault).toBe(0.42);
    expect(faceCaptureQuality).toEqual({
      detectorMinConfidence: 0.6,
      detectorMaxFaces: 2,
      cameraWidth: 1280,
      cameraHeight: 720,
      lightSampleWidth: 96,
      lightSampleHeight: 72,
      brightnessMin: 42,
      brightnessMax: 218,
      sharpnessMin: 16,
      faceWidthMin: 0.22,
      faceWidthMax: 0.72,
      centerXMin: 0.35,
      centerXMax: 0.65,
      centerYMin: 0.25,
      centerYMax: 0.75,
      eyeAspectRatioMin: 0.12,
      yawLimitDegrees: 15,
      pitchLimitDegrees: 15,
      rollLimitDegrees: 12,
      sideYawDegrees: 8,
      stableCaptureMs: 1000,
    });
  });

  it("accepts same-person synthetic captures with small descriptor noise", () => {
    const result = analyzeEnrollmentEmbeddings([
      vector(0.1),
      vector(0.105),
      vector(0.098),
      vector(0.102),
    ]);

    expect(result.consistent).toBe(true);
    expect(result.discardedOutlier).toBe(false);
  });

  it("rejects embeddings that represent different people", () => {
    const first = vector(0.1);
    const second = vector(0.9);
    const third = vector(-0.8);
    expect(analyzeEnrollmentEmbeddings([first, second, third]).consistent).toBe(false);
  });

  it.each([
    { embeddings: [Array(64).fill(0), vector(0.1), vector(0.1)], reason: "ZERO_NORM" },
    { embeddings: [vector(0.1), vector(0.1).map((value, index) => index === 3 ? Number.NaN : value), vector(0.1)], reason: "INVALID_VALUE" },
    { embeddings: [vector(0.1), vector(0.1, 63), vector(0.1)], reason: "INVALID_DIMENSION" },
  ])("rejects invalid descriptors with a specific reason", ({ embeddings, reason }) => {
    expect(analyzeEnrollmentEmbeddings(embeddings).reason).toBe(reason);
  });

  it("discards one outlier only when at least three captures form a consistent core", () => {
    const result = analyzeEnrollmentEmbeddings([
      vector(0.1),
      vector(0.102),
      vector(0.098),
      vector(1.2),
    ]);

    expect(result.consistent).toBe(true);
    expect(result.discardedOutlier).toBe(true);
    expect(result.distances).toHaveLength(4);
  });

  it("measures each capture from a coordinate-wise median instead of every pair", () => {
    const captures = [vector(0.1), vector(0.102), vector(0.098), vector(1.2)];
    const result = analyzeEnrollmentEmbeddings(captures);

    expect(result.consistent).toBe(true);
    expect(result.discardedOutlier).toBe(true);
    expect(result.distances).toHaveLength(captures.length);
  });

  it("round-trips the encrypted JSON descriptor and rejects mismatched dimensions", () => {
    process.env.FACE_EMBEDDING_ENCRYPTION_KEY = "a".repeat(64);
    const embedding = vector(0.25);
    const encrypted = encryptEmbedding(embedding);
    const restored = decryptEmbedding(encrypted.ciphertext, encrypted.iv, encrypted.tag);

    expect(restored).toEqual(embedding);
    expect(analyzeEnrollmentEmbeddings([embedding, vector(0.25, 63), vector(0.25)]).consistent).toBe(false);
  });
});
