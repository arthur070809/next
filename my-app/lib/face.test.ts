import { afterEach, describe, expect, it, vi } from "vitest";
import {
  analyzeEnrollmentEmbeddings,
  aggregateEnrollmentEmbeddings,
  areFaceTemplateVersionsCompatible,
  bestFaceMatchPerEmployee,
  decryptEmbedding,
  encryptEmbedding,
  FaceEncryptionKeyUnavailableError,
  faceEnrollmentConsistencyDistance,
  faceEnrollmentDuplicateDistance,
  faceMatchThresholdDefault,
  getFaceEmbeddingModelVersion,
  FaceServiceUnavailableError,
  getFaceIdentifyMinMargin,
  getFaceMatchThreshold,
  faceEmbeddingDistance,
  isFaceEmbeddingMatch,
  enrollFaceSamples,
  validateFaceCapture,
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

  it("aggregates consistent burst vectors into one normalized template", () => {
    const result = aggregateEnrollmentEmbeddings([
      vector(0.1),
      vector(0.102),
      vector(0.098),
      vector(0.101),
      vector(1.2),
    ]);

    expect(result.consistent).toBe(true);
    expect(result.discardedOutlier).toBe(true);
    expect(result.embedding).not.toBeNull();
    expect(Math.hypot(...(result.embedding ?? []))).toBeCloseTo(1, 12);
  });

  it("returns a retryable rejection for an incoherent burst without a template", () => {
    const result = aggregateEnrollmentEmbeddings([
      vector(0.1),
      vector(0.9),
      vector(-0.8),
      vector(1.4),
      vector(-1.2),
    ]);

    expect(result.consistent).toBe(false);
    expect(result.embedding).toBeNull();
  });

  it("requires a configured, valid embedding model version for new templates", () => {
    expect(getFaceEmbeddingModelVersion("provider-model-2026.10")).toBe("provider-model-2026.10");
    expect(() => getFaceEmbeddingModelVersion("")).toThrow(FaceServiceUnavailableError);
    expect(() => getFaceEmbeddingModelVersion("x".repeat(81))).toThrow(FaceServiceUnavailableError);
  });

  it("allows one legacy template set or one configured version, but never mixed versions", () => {
    expect(areFaceTemplateVersionsCompatible(["legacy-unknown", "legacy-unknown"])).toBe(true);
    expect(areFaceTemplateVersionsCompatible(["model-a", "model-a"], "model-a")).toBe(true);
    expect(areFaceTemplateVersionsCompatible(["model-a"], "model-b")).toBe(false);
    expect(areFaceTemplateVersionsCompatible(["legacy-unknown", "model-a"], "model-a")).toBe(false);
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

  it("fails closed when the template encryption key is absent", () => {
    vi.stubEnv("FACE_EMBEDDING_ENCRYPTION_KEY", "");
    expect(() => encryptEmbedding(vector(0.25))).toThrow(FaceEncryptionKeyUnavailableError);
  });

  it("validates the match threshold without changing the configured default", () => {
    expect(getFaceMatchThreshold(undefined)).toBe(faceMatchThresholdDefault);
    expect(getFaceMatchThreshold("0.51")).toBe(0.51);
    expect(getFaceMatchThreshold("0")).toBe(0);
    for (const invalid of ["", "NaN", "Infinity", "-0.1"]) {
      expect(() => getFaceMatchThreshold(invalid)).toThrow(FaceServiceUnavailableError);
    }
  });

  it("keeps the ambiguity margin non-negative", () => {
    expect(getFaceIdentifyMinMargin(undefined)).toBe(0.08);
    expect(getFaceIdentifyMinMargin("0")).toBe(0);
    for (const invalid of ["", "-0.01", "NaN", "Infinity"]) {
      expect(() => getFaceIdentifyMinMargin(invalid)).toThrow(FaceServiceUnavailableError);
    }
  });

  it("accepts synthetic login distances only below the configured threshold", () => {
    const reference = Array(64).fill(0);
    const atBoundary = [0.42, ...Array(63).fill(0)];
    const belowBoundary = [0.4199, ...Array(63).fill(0)];
    const threshold = getFaceMatchThreshold("0.42");

    expect(faceEmbeddingDistance(reference, atBoundary)).toBeCloseTo(threshold, 12);
    expect(isFaceEmbeddingMatch(faceEmbeddingDistance(reference, belowBoundary), threshold)).toBe(true);
    expect(isFaceEmbeddingMatch(faceEmbeddingDistance(reference, atBoundary), threshold)).toBe(false);
    expect(isFaceEmbeddingMatch(Number.POSITIVE_INFINITY, threshold)).toBe(false);
  });

  it("ranks distinct people rather than treating legacy templates from one person as ambiguity", () => {
    expect(bestFaceMatchPerEmployee([
      { funcionarioId: 1, cracha: "1000", distance: 0.1 },
      { funcionarioId: 1, cracha: "1000", distance: 0.11 },
      { funcionarioId: 2, cracha: "2000", distance: 0.4 },
    ])).toEqual([
      { funcionarioId: 1, cracha: "1000", distance: 0.1 },
      { funcionarioId: 2, cracha: "2000", distance: 0.4 },
    ]);
  });

  it("does not call the provider for missing or malformed templates", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const capture = `data:image/jpeg;base64,${"A".repeat(1400)}`;

    await expect(verifyFaceCapture(capture, { tipo: "piscar", nonce: "nonce" }, [])).resolves.toBe(false);
    await expect(verifyFaceCapture(capture, { tipo: "piscar", nonce: "nonce" }, [vector(0.1, 31)])).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates live image data URLs before sending them to a facial provider", () => {
    expect(validateFaceCapture(`data:image/jpeg;base64,${"A".repeat(1400)}`)).toContain("data:image/jpeg");
    expect(() => validateFaceCapture("data:image/svg+xml;base64,AAAA")).toThrow();
    expect(() => validateFaceCapture("not-an-image")).toThrow();
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

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      livenessPassed: true,
      matched: true,
    }), { status: 200, headers: { "content-type": "application/json" } })));
    await expect(verifyFaceCapture(capture, { tipo: "piscar", nonce: "nonce" }, [vector(0.1)]))
      .resolves.toBe(true);

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      livenessPassed: false,
      matched: true,
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
    await expect(enrollFaceSamples(Array.from({ length: 5 }, () => capture), { nonce: "nonce" }))
      .rejects.toBeInstanceOf(FaceServiceUnavailableError);
  });
});
