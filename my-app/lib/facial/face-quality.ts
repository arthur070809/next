import { blinkOpenEarMinimum } from "./blink";

export const FACE_QUALITY_LIMITS = {
  cameraWidth: 1280,
  cameraHeight: 720,
  lightSampleWidth: 96,
  lightSampleHeight: 72,
  // Detection scores are Human's confidence values; calibrate these with the device matrix used in testing.
  minimumDetectionConfidence: 0.45,
  minimumOpenEyeAspectRatio: blinkOpenEarMinimum,
  // Width is a fraction of the full video frame. The upper bound avoids cropped faces too close to the lens.
  minimumFaceWidthRatio: 0.15,
  maximumFaceWidthRatio: 0.9,
  minimumCenterXRatio: 0.15,
  maximumCenterXRatio: 0.85,
  minimumCenterYRatio: 0.1,
  maximumCenterYRatio: 0.9,
  // Keep broad pose tolerance to reduce mobile false rejects.
  maximumYawDegrees: 25,
  maximumPitchDegrees: 25,
  maximumRollDegrees: 25,
  // Sharpness is mean absolute adjacent-pixel luma difference after downscaling to 96x72.
  // Tune against diagnostic values from supported phones; this is only a severe-blur guard.
  minimumSharpness: 5.5,
  minimumBrightness: 30,
  maximumBrightness: 235,
  // A second face is ignored only when the largest face has at least this area ratio.
  dominantFaceAreaRatio: 1.5,
  candidateFrameCount: 3,
  maximumCandidateFrames: 5,
  maximumCollectionMs: 1_500,
  immediateCaptureScore: 0.92,
  noValidFaceMessageDelayMs: 3_000,
  analysisIntervalMs: 150,
  automaticAttemptIntervalMs: 2_000,
  maximumAutomaticAttempts: 3,
} as const;

export type FaceQualityMeasurements = {
  faceCount: number;
  faceWidthRatio: number;
  centerXRatio: number;
  centerYRatio: number;
  yawDegrees: number;
  pitchDegrees: number;
  rollDegrees: number;
  sharpness: number;
  detectionConfidence: number;
  brightness: number;
};

export type FaceQualityResult = {
  valid: boolean;
  score: number;
  reason: "valid" | "face-count" | "size" | "position" | "pose" | "blur" | "detection" | "light";
};

export function evaluateFaceQuality(metrics: FaceQualityMeasurements): FaceQualityResult {
  const limits = FACE_QUALITY_LIMITS;
  if (![metrics.faceWidthRatio, metrics.centerXRatio, metrics.centerYRatio,
    metrics.yawDegrees, metrics.pitchDegrees, metrics.rollDegrees,
    metrics.sharpness, metrics.detectionConfidence, metrics.brightness].every(Number.isFinite)) {
    return { valid: false, score: 0, reason: "detection" };
  }
  if (metrics.faceCount !== 1) return { valid: false, score: 0, reason: "face-count" };
  if (metrics.faceWidthRatio < limits.minimumFaceWidthRatio
    || metrics.faceWidthRatio > limits.maximumFaceWidthRatio) return { valid: false, score: 0, reason: "size" };
  if (metrics.centerXRatio < limits.minimumCenterXRatio || metrics.centerXRatio > limits.maximumCenterXRatio
    || metrics.centerYRatio < limits.minimumCenterYRatio || metrics.centerYRatio > limits.maximumCenterYRatio) {
    return { valid: false, score: 0, reason: "position" };
  }
  if (Math.abs(metrics.yawDegrees) > limits.maximumYawDegrees
    || Math.abs(metrics.pitchDegrees) > limits.maximumPitchDegrees
    || Math.abs(metrics.rollDegrees) > limits.maximumRollDegrees) return { valid: false, score: 0, reason: "pose" };
  if (metrics.sharpness < limits.minimumSharpness) return { valid: false, score: 0, reason: "blur" };
  if (metrics.detectionConfidence < limits.minimumDetectionConfidence) return { valid: false, score: 0, reason: "detection" };
  if (metrics.brightness < limits.minimumBrightness || metrics.brightness > limits.maximumBrightness) {
    return { valid: false, score: 0, reason: "light" };
  }
  const poseScore = 1 - (
    Math.abs(metrics.yawDegrees) / limits.maximumYawDegrees
    + Math.abs(metrics.pitchDegrees) / limits.maximumPitchDegrees
    + Math.abs(metrics.rollDegrees) / limits.maximumRollDegrees
  ) / 3;
  const sharpnessScore = Math.min(1, metrics.sharpness / (limits.minimumSharpness * 4));
  const confidenceScore = Math.min(1, metrics.detectionConfidence);
  const horizontalCenterScore = 1 - Math.abs(metrics.centerXRatio - 0.5) / 0.5;
  const verticalCenterScore = 1 - Math.abs(metrics.centerYRatio - 0.5) / 0.5;
  const centerScore = (horizontalCenterScore + verticalCenterScore) / 2;
  const score = poseScore * 0.35 + sharpnessScore * 0.35 + confidenceScore * 0.2 + centerScore * 0.1;
  return { valid: true, score, reason: "valid" };
}

export function selectDominantFace<T>(
  faces: readonly T[],
  getBox: (face: T) => readonly number[],
) {
  if (faces.length === 0) return null;
  const ranked = faces.map((face) => {
    const box = getBox(face);
    const width = box[2] ?? 0;
    const height = box[3] ?? 0;
    return { face, area: Math.max(0, width) * Math.max(0, height) };
  }).sort((first, second) => second.area - first.area);
  if (ranked.length > 1
    && (ranked[1].area <= 0 || ranked[0].area / ranked[1].area < FACE_QUALITY_LIMITS.dominantFaceAreaRatio)) {
    return null;
  }
  return ranked[0].face;
}

export function shouldFinishFrameCollection(input: {
  scores: readonly number[];
  requestedFrameCount: number;
  elapsedMs: number;
}) {
  const requiredCount = Math.max(FACE_QUALITY_LIMITS.candidateFrameCount, input.requestedFrameCount);
  const immediate = input.requestedFrameCount === 1
    && input.scores.length === 1
    && input.scores[0] >= FACE_QUALITY_LIMITS.immediateCaptureScore;
  if (immediate) return true;
  if (input.scores.length >= requiredCount) return true;
  return input.elapsedMs >= FACE_QUALITY_LIMITS.maximumCollectionMs
    && input.scores.length >= input.requestedFrameCount;
}

export function canStartAutomaticAttempt(input: {
  attempts: number;
  lastAttemptAt: number;
  now: number;
  inFlight: boolean;
}) {
  return !input.inFlight
    && input.attempts < FACE_QUALITY_LIMITS.maximumAutomaticAttempts
    && input.now - input.lastAttemptAt >= FACE_QUALITY_LIMITS.automaticAttemptIntervalMs;
}
