export type EnrollmentQuality = {
  faceCount: number;
  centered: boolean;
  sizeValid: boolean;
  frontFacing: boolean;
  brightnessValid: boolean;
  sharpnessValid: boolean;
  eyesVisible: boolean;
  detectionValid: boolean;
};

export type EnrollmentFrameQuality = {
  sharpness: number;
  yawDegrees: number;
  pitchDegrees: number;
  rollDegrees: number;
  eyesOpen: boolean;
  brightness: number;
};

export type ScoredEnrollmentFrame<T> = { frame: T; score: number };

export function scoreEnrollmentFrameQuality(quality: EnrollmentFrameQuality) {
  if (
    !quality.eyesOpen
    || ![quality.sharpness, quality.yawDegrees, quality.pitchDegrees, quality.rollDegrees, quality.brightness].every(Number.isFinite)
  ) return Number.NEGATIVE_INFINITY;

  const sharpnessScore = Math.min(1, Math.max(0, quality.sharpness) / 64);
  const poseDeviation = (Math.abs(quality.yawDegrees) / 15
    + Math.abs(quality.pitchDegrees) / 15
    + Math.abs(quality.rollDegrees) / 12) / 3;
  const poseScore = Math.max(0, 1 - poseDeviation);
  const brightnessScore = Math.max(0, 1 - Math.abs(quality.brightness - 130) / 130);
  return sharpnessScore * 0.4 + poseScore * 0.35 + brightnessScore * 0.25;
}

export function selectBestEnrollmentFrames<T>(
  candidates: Array<ScoredEnrollmentFrame<T>>,
  count: number,
) {
  if (!Number.isSafeInteger(count) || count < 1) return [];
  return candidates
    .filter((candidate) => Number.isFinite(candidate.score))
    .sort((first, second) => second.score - first.score)
    .slice(0, count)
    .map(({ frame }) => frame);
}

export function isEnrollmentQualityValid(quality: EnrollmentQuality) {
  return quality.faceCount === 1
    && quality.centered
    && quality.sizeValid
    && quality.frontFacing
    && quality.brightnessValid
    && quality.sharpnessValid
    && quality.eyesVisible
    && quality.detectionValid;
}

export function enrollmentQualityInstruction(quality: EnrollmentQuality) {
  if (quality.faceCount === 0) return "Nenhum rosto detectado. Posicione o rosto na oval";
  if (quality.faceCount > 1) return "Mais de um rosto na câmera";
  if (!quality.centered) return "Posicione o rosto na oval";
  if (!quality.sizeValid) return "Aproxime ou afaste o rosto para enquadrá-lo";
  if (!quality.frontFacing) return "Olhe de frente para a câmera";
  if (!quality.brightnessValid) return "Mais luz no ambiente";
  if (!quality.sharpnessValid) return "Mantenha o aparelho firme";
  if (!quality.eyesVisible) return "Mantenha os dois olhos visíveis";
  if (!quality.detectionValid) return "Não foi possível detectar o rosto com clareza";
  return "Segure parado e pisque uma vez; a captura será automática";
}

export function shouldSubmitEnrollmentFrames(input: {
  stableForMs: number;
  minimumStableMs: number;
  blinkObserved: boolean;
  frameCount: number;
  minimumFrames: number;
}) {
  return input.stableForMs >= input.minimumStableMs
    && input.blinkObserved
    && input.frameCount >= input.minimumFrames;
}
