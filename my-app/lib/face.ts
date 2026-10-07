import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import {
  faceEnrollmentConsistencyDistance,
  faceEnrollmentDuplicateDistance,
  faceMatchThresholdDefault,
} from "./facial/config";

export { faceConsentVersion } from "./face-consent";
export {
  faceEnrollmentConsistencyDistance,
  faceEnrollmentDuplicateDistance,
  faceMatchThresholdDefault,
};

export const livenessChallengeTtlMs = 60 * 1000;
export const faceAttemptLimit = 3;
export const faceBlockDurationMs = 15 * 60 * 1000;
export const faceEnrollmentNonceTtlMs = 2 * 60 * 1000;
type FaceServiceEmbeddingResponse = { embeddings?: number[][]; reason?: string; code?: string };
type FaceServiceVerifyResponse = { livenessPassed?: boolean; matched?: boolean };

export class FaceEnrollmentVerificationError extends Error {
  readonly code: string;

  constructor(message: string, code = "FACE_VERIFICATION_FAILED") {
    super(message);
    this.name = "FaceEnrollmentVerificationError";
    this.code = code;
  }
}

function faceEncryptionKey() {
  const raw = process.env.FACE_EMBEDDING_ENCRYPTION_KEY;
  if (!raw) throw new Error("FACE_EMBEDDING_ENCRYPTION_KEY is not configured.");
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("FACE_EMBEDDING_ENCRYPTION_KEY must decode to 32 bytes.");
  return key;
}

function serviceUrl() {
  const value = process.env.FACE_SERVICE_URL?.trim();
  if (!value) throw new Error("FACE_SERVICE_URL is not configured.");
  return value.replace(/\/$/, "");
}

export function hashFaceNonce(nonce: string) {
  return createHash("sha256").update(nonce).digest("hex");
}

export function createFaceNonce() {
  return randomBytes(32).toString("base64url");
}

export function encryptEmbedding(embedding: number[]) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", faceEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(embedding), "utf8"), cipher.final()]);
  return { ciphertext, iv, tag: cipher.getAuthTag() };
}

export function decryptEmbedding(ciphertext: Uint8Array, iv: Uint8Array, tag: Uint8Array) {
  const decipher = createDecipheriv("aes-256-gcm", faceEncryptionKey(), Buffer.from(iv));
  decipher.setAuthTag(Buffer.from(tag));
  const embedding = JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext)), decipher.final()]).toString("utf8"));
  if (!Array.isArray(embedding) || embedding.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
    throw new Error("Invalid encrypted face embedding.");
  }
  return embedding as number[];
}

function validateCapture(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("data:image/")) throw new Error("Invalid facial capture.");
  const comma = value.indexOf(",");
  if (comma < 0) throw new Error("Invalid facial capture.");
  const metadata = value.slice(0, comma).toLowerCase();
  if (!metadata.includes(";base64") || !(metadata.includes("image/jpeg") || metadata.includes("image/webp") || metadata.includes("image/png"))) {
    throw new Error("Unsupported facial capture.");
  }
  const bytes = Buffer.from(value.slice(comma + 1), "base64");
  if (bytes.length < 1024 || bytes.length > 2 * 1024 * 1024) throw new Error("Invalid facial capture size.");
  return value;
}

async function callFaceService<T>(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${serviceUrl()}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.FACE_SERVICE_TOKEN ?? ""}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Face service returned ${response.status}.`);
  return await response.json() as T;
}

function enrollmentVerificationMessage(code: string | undefined, reason: string | undefined) {
  switch (code?.toUpperCase()) {
    case "NO_FACE": return { code: "FACE_NO_FACE", message: "Nenhum rosto detectado." };
    case "MULTIPLE_FACES": return { code: "FACE_MULTIPLE_FACES", message: "Mais de um rosto na imagem." };
    case "DARK":
    case "LOW_LIGHT": return { code: "FACE_LOW_LIGHT", message: "Imagem muito escura." };
    case "BLUR":
    case "LOW_SHARPNESS": return { code: "FACE_BLUR", message: "Imagem sem nitidez suficiente." };
    case "LIVENESS_FAILED": return { code: "FACE_LIVENESS_FAILED", message: "Não foi possível confirmar a prova de vida." };
    case "INCONSISTENT_SAMPLES": return { code: "FACE_INCONSISTENT_SAMPLES", message: "As capturas ficaram diferentes. Tente novamente." };
    default: return reason === "no_face" ? { code: "FACE_NO_FACE", message: "Nenhum rosto detectado." } : { code: "FACE_VERIFICATION_FAILED", message: "Não foi possível processar as capturas. Tente novamente." };
  }
}

export async function enrollFaceSamples(samples: unknown[], options: { nonce?: string } = {}) {
  if (samples.length < 3 || samples.length > 5) throw new Error("Enrollment requires 3 to 5 captures.");
  const captures = samples.map(validateCapture);
  const result = await callFaceService<FaceServiceEmbeddingResponse>("/v1/enroll", { captures, nonce: options.nonce });
  if (result.code || result.reason) {
    const failure = enrollmentVerificationMessage(result.code, result.reason);
    throw new FaceEnrollmentVerificationError(failure.message, failure.code);
  }
  if (!Array.isArray(result.embeddings) || result.embeddings.length !== captures.length || result.embeddings.some((embedding) => !Array.isArray(embedding) || embedding.length < 32)) {
    throw new Error("Face service returned invalid embeddings.");
  }
  return result.embeddings;
}

export async function verifyFaceCapture(capture: unknown, challenge: { tipo: string; nonce: string }, templates: number[][]) {
  const image = validateCapture(capture);
  const result = await callFaceService<FaceServiceVerifyResponse>("/v1/verify", {
    capture: image,
    challenge: challenge.tipo,
    nonce: challenge.nonce,
    templates,
    threshold: Number(process.env.FACE_MATCH_THRESHOLD ?? faceMatchThresholdDefault),
  });
  return result.livenessPassed === true && result.matched === true;
}

const enrollmentNonces = new Map<string, { adminId: number; employeeId: number; expiresAt: number }>();

export function createFaceEnrollmentNonce(adminId: number, employeeId: number) {
  const nonce = createFaceNonce();
  enrollmentNonces.set(nonce, { adminId, employeeId, expiresAt: Date.now() + faceEnrollmentNonceTtlMs });
  return nonce;
}

export function consumeFaceEnrollmentNonce(nonce: string, adminId: number, employeeId: number) {
  const challenge = enrollmentNonces.get(nonce);
  enrollmentNonces.delete(nonce);
  return Boolean(challenge && challenge.expiresAt > Date.now() && challenge.adminId === adminId && challenge.employeeId === employeeId);
}

export function faceEmbeddingDistance(first: number[], second: number[]) {
  if (first.length < 32 || first.length !== second.length) return Number.POSITIVE_INFINITY;
  if (first.some((value) => !Number.isFinite(value)) || second.some((value) => !Number.isFinite(value))) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.sqrt(first.reduce((sum, value, index) => sum + (value - second[index]) ** 2, 0));
}

export type EnrollmentEmbeddingAnalysis = {
  consistent: boolean;
  reason?: "INVALID_DIMENSION" | "INVALID_VALUE" | "ZERO_NORM";
  distances: number[];
  discardedOutlier: boolean;
  acceptedEmbeddings: number[][];
};

function validateEnrollmentEmbeddings(embeddings: number[][]): EnrollmentEmbeddingAnalysis["reason"] | undefined {
  if (embeddings.length < 3 || embeddings.some((embedding) => embedding.length < 32)) return "INVALID_DIMENSION";
  const dimension = embeddings[0].length;
  if (embeddings.some((embedding) => embedding.length !== dimension)) return "INVALID_DIMENSION";
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
  if (reason) {
    return { consistent: false, reason, distances: [], discardedOutlier: false, acceptedEmbeddings: [] };
  }

  const distances = distancesFromMedian(embeddings);
  const outlierIndexes = distances.flatMap((distance, index) =>
    distance > faceEnrollmentConsistencyDistance ? [index] : [],
  );
  if (outlierIndexes.length === 0) {
    return { consistent: true, distances, discardedOutlier: false, acceptedEmbeddings: embeddings };
  }

  if (embeddings.length > 3 && outlierIndexes.length === 1) {
    const candidate = embeddings.filter((_, index) => index !== outlierIndexes[0]);
    if (distancesFromMedian(candidate).every((distance) => distance <= faceEnrollmentConsistencyDistance)) {
      return {
        consistent: true,
        distances,
        discardedOutlier: true,
        acceptedEmbeddings: candidate,
      };
    }
  }

  return { consistent: false, distances, discardedOutlier: false, acceptedEmbeddings: [] };
}

export function areEnrollmentEmbeddingsConsistent(embeddings: number[][]) {
  return analyzeEnrollmentEmbeddings(embeddings).consistent;
}