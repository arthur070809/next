// Provider-owned descriptor scale; its service contract does not identify an
// embedding-library recommendation, so keep this value unchanged until FAR/FRR
// data from that provider justifies a measured adjustment. Applied to median distance.
export const faceEnrollmentConsistencyDistance = 0.35;
export const faceEnrollmentDuplicateDistance = 0.42;
export const faceEnrollmentBurstSize = 5;
export const faceEnrollmentMaximumBurstSize = 8;
export const faceEnrollmentFrameIntervalMs = 160;

// Operational starting point documented in README.md; login remains fail-closed
// and the biometric provider must calibrate FAR/FRR before production use.
export const faceMatchThresholdDefault = 0.42;

// Capture gates are application heuristics, not recommendations from Human.
// The 0.6 detection-score floor matches the configured Human detector minConfidence.
export const faceCaptureQuality = {
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
} as const;
