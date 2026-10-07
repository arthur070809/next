// Enrollment separation heuristics are not login thresholds or FAR/FRR guarantees.
export const faceEnrollmentConsistencyDistance = 0.35;
export const faceEnrollmentDuplicateDistance = 0.42;
export const faceEnrollmentMaximumBurstSize = 5;
export const faceEmbeddingDimension = 256;
export const faceEmbeddingModelVersion = "human-3.3.6-mobileface-v3-a4bcf70";

// TODO(LGPD): restore the privacy notice and obtain legal review before enrolling real employees.
export function isFaceEnrollmentConsentRequired(value = process.env.FACE_ENROLL_REQUIRE_CONSENT) {
  return value === "true";
}

export function isFaceBlinkRequired(value = process.env.NEXT_PUBLIC_FACE_REQUIRE_BLINK) {
  return value === "true";
}

export function isFaceLoginEnabled(value = process.env.FACE_LOGIN_ENABLED) {
  return value !== "false";
}

export function getFaceEnrollmentFrameCount(value = process.env.FACE_ENROLL_FRAMES) {
  if (value === undefined) return 1;
  const normalized = value.trim();
  if (!/^[1-5]$/.test(normalized)) return 1;
  return Number(normalized);
}
