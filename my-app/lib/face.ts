import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import {
  faceEmbeddingDimension,
  faceEmbeddingModelVersion,
  faceEnrollmentConsistencyDistance,
  faceEnrollmentDuplicateDistance,
  faceEnrollmentMaximumBurstSize,
  getFaceEnrollmentFrameCount,
} from "./facial/config";

export { faceConsentVersion } from "./face-consent";
export { faceEnrollmentConsistencyDistance, faceEnrollmentDuplicateDistance };
export { faceEmbeddingDimension, faceEmbeddingModelVersion } from "./facial/config";

export const livenessChallengeTtlMs = 60 * 1000;
export const faceAttemptLimit = 3;
export const faceBlockDurationMs = 15 * 60 * 1000;

export class FaceRecognitionUnavailableError extends Error {
  constructor() {
    super("Local facial recognition is unavailable.");
    this.name = "FaceRecognitionUnavailableError";
  }
}

export class FaceEncryptionKeyUnavailableError extends Error {
  constructor() {
    super("FACE_EMBEDDING_ENCRYPTION_KEY is unavailable or invalid.");
    this.name = "FaceEncryptionKeyUnavailableError";
  }
}

export class FaceEnrollmentVerificationError extends Error {
  readonly code: string;

  constructor(message: string, code = "FACE_VERIFICATION_FAILED") {
    super(message);
    this.name = "FaceEnrollmentVerificationError";
    this.code = code;
  }
}

export function getFaceEmbeddingModelVersion(value = process.env.FACE_EMBEDDING_MODEL_VERSION) {
  if (value?.trim() !== faceEmbeddingModelVersion) throw new FaceRecognitionUnavailableError();
  return faceEmbeddingModelVersion;
}

export function assertFaceTemplateConfiguration() {
  faceEncryptionKey();
  return getFaceEmbeddingModelVersion();
}

export function areFaceTemplateVersionsCompatible(
  versions: string[],
  configuredVersion = process.env.FACE_EMBEDDING_MODEL_VERSION,
) {
  return versions.length > 0
    && new Set(versions).size === 1
    && versions[0] !== "legacy-unknown"
    && versions[0] === configuredVersion?.trim()
    && versions[0] === faceEmbeddingModelVersion;
}

export function getFaceMatchThreshold(value = process.env.FACE_MOBILEFACE_MATCH_THRESHOLD) {
  if (value === undefined) throw new FaceRecognitionUnavailableError();
  const threshold = Number(value.trim());
  if (!value.trim() || !Number.isFinite(threshold) || threshold <= 0 || threshold > 2) {
    throw new FaceRecognitionUnavailableError();
  }
  return threshold;
}

export function getFaceIdentifyMinMargin(value = process.env.FACE_IDENTIFY_MIN_MARGIN) {
  if (value === undefined) return 0.08;
  const margin = Number(value.trim());
  if (!value.trim() || !Number.isFinite(margin) || margin < 0) throw new FaceRecognitionUnavailableError();
  return margin;
}

function faceEncryptionKey() {
  const raw = process.env.FACE_EMBEDDING_ENCRYPTION_KEY;
  if (!raw) throw new FaceEncryptionKeyUnavailableError();
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) throw new FaceEncryptionKeyUnavailableError();
  return key;
}

export function hashFaceNonce(nonce: string) {
  return createHash("sha256").update(nonce).digest("hex");
}

export function createFaceNonce() {
  return randomBytes(32).toString("base64url");
}

export function validateFaceEmbedding(value: unknown) {
  if (!Array.isArray(value) || value.length !== faceEmbeddingDimension
    || value.some((component) => typeof component !== "number" || !Number.isFinite(component))) {
    throw new FaceEnrollmentVerificationError("O modelo facial não gerou um vetor válido.", "FACE_INVALID_VECTOR");
  }
  const embedding = value as number[];
  const norm = Math.hypot(...embedding);
  if (!Number.isFinite(norm) || norm < 0.95 || norm > 1.05) {
    throw new FaceEnrollmentVerificationError("Não foi possível validar a captura. Tente novamente.", "FACE_INVALID_VECTOR_NORM");
  }
  return embedding;
}

export function encryptEmbedding(embedding: number[]) {
  const validated = validateFaceEmbedding(embedding);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", faceEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(validated), "utf8"), cipher.final()]);
  return { ciphertext, iv, tag: cipher.getAuthTag() };
}

export function decryptEmbedding(ciphertext: Uint8Array, iv: Uint8Array, tag: Uint8Array) {
  const decipher = createDecipheriv("aes-256-gcm", faceEncryptionKey(), Buffer.from(iv));
  decipher.setAuthTag(Buffer.from(tag));
  const embedding = JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext)), decipher.final()]).toString("utf8"));
  return validateFaceEmbedding(embedding);
}

export function faceEmbeddingDistance(first: number[], second: number[]) {
  if (first.length !== faceEmbeddingDimension || first.length !== second.length) return Number.POSITIVE_INFINITY;
  if (first.some((value) => !Number.isFinite(value)) || second.some((value) => !Number.isFinite(value))) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.sqrt(first.reduce((sum, value, index) => sum + (value - second[index]) ** 2, 0));
}

export function isFaceEmbeddingMatch(distance: number, threshold: number) {
  return Number.isFinite(distance) && Number.isFinite(threshold) && threshold > 0 && distance < threshold;
}

export function bestFaceMatchPerEmployee(candidates: Array<{ funcionarioId: number; cracha: string; distance: number }>) {
  const bestByEmployee = new Map<number, { funcionarioId: number; cracha: string; distance: number }>();
  for (const candidate of candidates) {
    const current = bestByEmployee.get(candidate.funcionarioId);
    if (!current || candidate.distance < current.distance) bestByEmployee.set(candidate.funcionarioId, candidate);
  }
  return [...bestByEmployee.values()].sort((first, second) => first.distance - second.distance);
}

export type EnrollmentEmbeddingAnalysis = {
  consistent: boolean;
  reason?: "INVALID_DIMENSION" | "INVALID_VALUE" | "ZERO_NORM";
  distances: number[];
  discardedOutlier: boolean;
  acceptedEmbeddings: number[][];
};

function validateEnrollmentEmbeddings(embeddings: number[][]): EnrollmentEmbeddingAnalysis["reason"] | undefined {
  if (embeddings.length < 2 || embeddings.length > faceEnrollmentMaximumBurstSize) return "INVALID_DIMENSION";
  if (embeddings.some((embedding) => embedding.length !== faceEmbeddingDimension)) return "INVALID_DIMENSION";
  if (embeddings.some((embedding) => embedding.some((value) => !Number.isFinite(value)))) return "INVALID_VALUE";
  if (embeddings.some((embedding) => Math.hypot(...embedding) <= 1e-12)) return "ZERO_NORM";
  return undefined;
}

function medianEmbedding(embeddings: number[][]) {
  const dimension = embeddings[0].length;
  return Array.from({ length: dimension }, (_, component) => {
    const values = embeddings.map((embedding) => embedding[component]).sort((a, b) => a - b);
    const middle = Math.floor(values.length / 2);
    return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
  });
}

function distancesFromMedian(embeddings: number[][]) {
  const median = medianEmbedding(embeddings);
  return embeddings.map((embedding) => faceEmbeddingDistance(embedding, median));
}

export function analyzeEnrollmentEmbeddings(embeddings: number[][]): EnrollmentEmbeddingAnalysis {
  const reason = validateEnrollmentEmbeddings(embeddings);
  if (reason) return { consistent: false, reason, distances: [], discardedOutlier: false, acceptedEmbeddings: [] };
  const distances = distancesFromMedian(embeddings);
  const outlierIndexes = distances.flatMap((distance, index) =>
    distance > faceEnrollmentConsistencyDistance ? [index] : [],
  );
  if (outlierIndexes.length === 0) return { consistent: true, distances, discardedOutlier: false, acceptedEmbeddings: embeddings };
  if (embeddings.length > 3 && outlierIndexes.length === 1) {
    const candidate = embeddings.filter((_, index) => index !== outlierIndexes[0]);
    if (distancesFromMedian(candidate).every((distance) => distance <= faceEnrollmentConsistencyDistance)) {
      return { consistent: true, distances, discardedOutlier: true, acceptedEmbeddings: candidate };
    }
  }
  return { consistent: false, distances, discardedOutlier: false, acceptedEmbeddings: [] };
}

export function aggregateEnrollmentEmbeddings(embeddings: number[][]) {
  const frameCount = getFaceEnrollmentFrameCount();
  if (embeddings.length !== frameCount) {
    return { consistent: false, reason: "INVALID_DIMENSION" as const, distances: [], discardedOutlier: false, acceptedEmbeddings: [], embedding: null };
  }
  if (embeddings.length === 1) {
    let embedding: number[];
    try {
      embedding = validateFaceEmbedding(embeddings[0]);
    } catch (error) {
      const reason = error instanceof FaceEnrollmentVerificationError && error.code === "FACE_INVALID_VECTOR_NORM"
        ? "ZERO_NORM"
        : "INVALID_DIMENSION";
      return { consistent: false, reason: reason as "ZERO_NORM" | "INVALID_DIMENSION", distances: [], discardedOutlier: false, acceptedEmbeddings: [], embedding: null };
    }
    return { consistent: true, distances: [], discardedOutlier: false, acceptedEmbeddings: [embedding], embedding };
  }
  const analysis = analyzeEnrollmentEmbeddings(embeddings);
  if (!analysis.consistent) return { ...analysis, embedding: null };
  const dimension = analysis.acceptedEmbeddings[0].length;
  const mean = Array.from({ length: dimension }, (_, index) =>
    analysis.acceptedEmbeddings.reduce((sum, embedding) => sum + embedding[index], 0) / analysis.acceptedEmbeddings.length,
  );
  const norm = Math.hypot(...mean);
  if (!Number.isFinite(norm) || norm <= 1e-12) {
    return { ...analysis, consistent: false, reason: "ZERO_NORM" as const, acceptedEmbeddings: [], embedding: null };
  }
  return { ...analysis, embedding: mean.map((value) => value / norm) };
}

export function areEnrollmentEmbeddingsConsistent(embeddings: number[][]) {
  return analyzeEnrollmentEmbeddings(embeddings).consistent;
}
