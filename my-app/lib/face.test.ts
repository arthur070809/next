import { afterEach, describe, expect, it, vi } from "vitest";
import {
  aggregateEnrollmentEmbeddings,
  analyzeEnrollmentEmbeddings,
  areFaceTemplateVersionsCompatible,
  decryptEmbedding,
  encryptEmbedding,
  encryptFaceDemoPhoto,
  FaceEncryptionKeyUnavailableError,
  FaceEnrollmentVerificationError,
  FaceRecognitionUnavailableError,
  faceEmbeddingDistance,
  faceEmbeddingModelVersion,
  getFaceEmbeddingModelVersion,
  getFaceMatchThreshold,
  isFaceEmbeddingMatch,
  validateFaceEmbedding,
} from "./face";
import { faceEmbeddingDimension, getFaceEnrollmentFrameCount } from "./facial/config";

const unitVector = (first = 1, second = 0) => [
  first,
  second,
  ...Array.from({ length: faceEmbeddingDimension - 2 }, () => 0),
];

describe("local facial recognition", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("validates finite, normalized MobileFace vectors at the expected dimension", () => {
    expect(validateFaceEmbedding(unitVector())).toHaveLength(faceEmbeddingDimension);
    expect(() => validateFaceEmbedding(unitVector().slice(1))).toThrow(FaceEnrollmentVerificationError);
    expect(() => validateFaceEmbedding(unitVector(Number.NaN))).toThrow(FaceEnrollmentVerificationError);
    expect(() => validateFaceEmbedding(Array(faceEmbeddingDimension).fill(0))).toThrow(FaceEnrollmentVerificationError);
    expect(() => validateFaceEmbedding(Array(faceEmbeddingDimension).fill(0.5))).toThrow(FaceEnrollmentVerificationError);
  });

  it("uses strict L2 distance matching and treats the boundary as rejected", () => {
    const first = unitVector();
    const second = unitVector(0.8, 0.6);
    const distance = faceEmbeddingDistance(first, second);
    expect(distance).toBeCloseTo(Math.sqrt(0.2 ** 2 + 0.6 ** 2), 12);
    expect(isFaceEmbeddingMatch(distance - 0.01, distance)).toBe(true);
    expect(isFaceEmbeddingMatch(distance, distance)).toBe(false);
    expect(faceEmbeddingDistance(first, unitVector(0, 1).slice(1))).toBe(Number.POSITIVE_INFINITY);
  });

  it("requires a measured MobileFace threshold and rejects invalid configurations", () => {
    expect(() => getFaceMatchThreshold(undefined)).toThrow(FaceRecognitionUnavailableError);
    expect(getFaceMatchThreshold("0.87")).toBe(0.87);
    for (const value of ["", "0", "2.01", "-1", "NaN", "Infinity"]) {
      expect(() => getFaceMatchThreshold(value)).toThrow(FaceRecognitionUnavailableError);
    }
  });

  it("requires exactly the configured model version and rejects legacy templates", () => {
    expect(getFaceEmbeddingModelVersion(faceEmbeddingModelVersion)).toBe(faceEmbeddingModelVersion);
    expect(() => getFaceEmbeddingModelVersion(undefined)).toThrow(FaceRecognitionUnavailableError);
    expect(areFaceTemplateVersionsCompatible([faceEmbeddingModelVersion], faceEmbeddingModelVersion)).toBe(true);
    expect(areFaceTemplateVersionsCompatible(["legacy-unknown"], faceEmbeddingModelVersion)).toBe(false);
    expect(areFaceTemplateVersionsCompatible(["old-model"], faceEmbeddingModelVersion)).toBe(false);
    expect(areFaceTemplateVersionsCompatible([faceEmbeddingModelVersion, "legacy-unknown"], faceEmbeddingModelVersion)).toBe(false);
  });

  it("encrypts and decrypts one normalized vector with AES-GCM", () => {
    vi.stubEnv("FACE_EMBEDDING_ENCRYPTION_KEY", "a".repeat(64));
    const vector = unitVector(0.8, 0.6);
    const encrypted = encryptEmbedding(vector);
    expect(decryptEmbedding(encrypted.ciphertext, encrypted.iv, encrypted.tag)).toEqual(vector);
  });

  it("encrypts demo photo bytes with the same AES-256-GCM key without logging them", () => {
    vi.stubEnv("FACE_EMBEDDING_ENCRYPTION_KEY", "a".repeat(64));
    const photo = Uint8Array.from([0xff, 0xd8, 1, 2, 3]);
    const encrypted = encryptFaceDemoPhoto(photo);
    expect(encrypted.ciphertext).not.toEqual(Buffer.from(photo));
    expect(encrypted.iv).toHaveLength(12);
    expect(encrypted.tag).toHaveLength(16);
  });

  it("fails closed when the encryption key is missing or malformed", () => {
    vi.stubEnv("FACE_EMBEDDING_ENCRYPTION_KEY", "");
    expect(() => encryptEmbedding(unitVector())).toThrow(FaceEncryptionKeyUnavailableError);
    vi.stubEnv("FACE_EMBEDDING_ENCRYPTION_KEY", "invalid");
    expect(() => encryptEmbedding(unitVector())).toThrow(FaceEncryptionKeyUnavailableError);
  });

  it("keeps single-frame enrollment free of median/outlier aggregation", () => {
    vi.stubEnv("FACE_ENROLL_FRAMES", "1");
    const result = aggregateEnrollmentEmbeddings([unitVector()]);
    expect(getFaceEnrollmentFrameCount()).toBe(1);
    expect(result.consistent).toBe(true);
    expect(result.distances).toEqual([]);
    expect(result.embedding).toEqual(unitVector());
  });

  it("continues median aggregation for three configured frames", () => {
    vi.stubEnv("FACE_ENROLL_FRAMES", "3");
    const result = aggregateEnrollmentEmbeddings([
      unitVector(),
      unitVector(0.99995, 0.01),
      unitVector(0.9998, 0.02),
    ]);
    expect(getFaceEnrollmentFrameCount()).toBe(3);
    expect(result.consistent).toBe(true);
    expect(result.distances).toHaveLength(3);
    expect(Math.hypot(...(result.embedding ?? []))).toBeCloseTo(1, 12);
  });

  it("drops one discrepant frame only after a consistent median core", () => {
    const outlier = unitVector(-1, 0);
    const embeddings = [unitVector(), unitVector(1, 0.01), unitVector(1, -0.01), outlier];
    const result = analyzeEnrollmentEmbeddings(embeddings);
    expect(result.consistent).toBe(true);
    expect(result.discardedOutlier).toBe(true);
    expect(result.acceptedEmbeddings).toHaveLength(3);
  });
});
