// The enrollment limit is the existing service policy; sample data must be
// measured against the provider's documented metric before changing it.
export const faceEnrollmentConsistencyDistance = 0.35;
export const faceEnrollmentDuplicateDistance = 0.42;

// Operational starting point documented in README.md; login remains fail-closed
// and the biometric provider must calibrate FAR/FRR before production use.
export const faceMatchThresholdDefault = 0.42;
