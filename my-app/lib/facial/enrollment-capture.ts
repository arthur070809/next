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
  if (!quality.brightnessValid) return "Ajuste a iluminação do ambiente";
  if (!quality.sharpnessValid) return "Mantenha o aparelho firme";
  if (!quality.eyesVisible) return "Mantenha os dois olhos visíveis";
  if (!quality.detectionValid) return "Não foi possível detectar o rosto com clareza";
  return "Segure parado e pisque uma vez; a captura será automática";
}

export function shouldAutoCaptureEnrollmentBurst(input: {
  stableForMs: number;
  minimumStableMs: number;
  blinkObserved: boolean;
  frameCount: number;
  minimumFrames: number;
  maximumFrames: number;
}) {
  return input.stableForMs >= input.minimumStableMs
    && input.blinkObserved
    && input.frameCount >= input.minimumFrames
    && input.frameCount <= input.maximumFrames;
}
