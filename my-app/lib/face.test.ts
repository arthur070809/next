import { afterEach, describe, expect, it, vi } from "vitest";
import {
  analyzeEnrollmentEmbeddings,
  decryptEmbedding,
  encryptEmbedding,
  faceEnrollmentConsistencyDistance,
  faceEnrollmentDuplicateDistance,
  faceMatchThresholdDefault,
  FaceServiceUnavailableError,
  getFaceMatchThreshold,
  enrollFaceSamples,
  verifyFaceCapture,
} from "./face";
import { faceCaptureQuality } from "./facial/config";

function vector(value: number, length = 64) {
  return Array.from({ length }, (_, index) => value + index / 1000);
}

describe("facial enrollment embedding policy", () => {
  const previousEncryptionKey = process.env.FACE_EMBEDDING_ENCRYPTION_KEY;

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
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

  it("validates the match threshold without changing the configured default", () => {
    expect(getFaceMatchThreshold(undefined)).toBe(faceMatchThresholdDefault);
    expect(getFaceMatchThreshold("0.51")).toBe(0.51);
    expect(getFaceMatchThreshold("0")).toBe(0);
    for (const invalid of ["", "NaN", "Infinity", "-0.1"]) {
      expect(() => getFaceMatchThreshold(invalid)).toThrow(FaceServiceUnavailableError);
    }
  });

  it("does not call the provider for missing or malformed templates", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const capture = `data:image/jpeg;base64,${"A".repeat(1400)}`;

    await expect(verifyFaceCapture(capture, { tipo: "piscar", nonce: "nonce" }, [])).resolves.toBe(false);
    await expect(verifyFaceCapture(capture, { tipo: "piscar", nonce: "nonce" }, [vector(0.1, 31)])).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed when facial provider is unavailable and accepts only its explicit match result", async () => {
    vi.stubEnv("FACE_SERVICE_URL", "https://face-service.invalid");
    vi.stubEnv("FACE_SERVICE_TOKEN", "test-token");
    vi.stubEnv("FACE_MATCH_THRESHOLD", "0.42");
    const fetchMock = vi.fn(async () => new Response("unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const capture = `data:image/jpeg;base64,${"A".repeat(1400)}`;

    await expect(verifyFaceCapture(capture, { tipo: "piscar", nonce: "nonce" }, [vector(0.1)]))
      .rejects.toBeInstanceOf(FaceServiceUnavailableError);
    expect(fetchMock).toHaveBeenCalledOnce();

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      livenessPassed: true,
      matched: false,
    }), { status: 200, headers: { "content-type": "application/json" } })));
    await expect(verifyFaceCapture(capture, { tipo: "piscar", nonce: "nonce" }, [vector(0.1)]))
      .resolves.toBe(false);
  });

  it("treats malformed provider output as a technical failure", async () => {
    vi.stubEnv("FACE_SERVICE_URL", "https://face-service.invalid");
    vi.stubEnv("FACE_SERVICE_TOKEN", "test-token");
    vi.stubEnv("FACE_MATCH_THRESHOLD", "0.42");
    const capture = `data:image/jpeg;base64,${"A".repeat(1400)}`;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ matched: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })));
    await expect(verifyFaceCapture(capture, { tipo: "piscar", nonce: "nonce" }, [vector(0.1)]))
      .rejects.toBeInstanceOf(FaceServiceUnavailableError);

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      embeddings: [[1, 2], [1, 2], [1, 2]],
    }), { status: 200, headers: { "content-type": "application/json" } })));
    await expect(enrollFaceSamples([capture, capture, capture], { nonce: "nonce" }))
      .rejects.toBeInstanceOf(FaceServiceUnavailableError);
  });
});
