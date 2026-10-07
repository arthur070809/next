export type EnrollmentStage = "front" | "left" | "right" | "blink";
export type EnrollmentStageWithStatus = EnrollmentStage | "success";

export function canUseFaceGallery(stage: EnrollmentStage, sampleCount: number) {
  return stage === "front" && sampleCount === 0;
}

export function getNextEnrollmentStage(
  stageOrder: EnrollmentStage[],
  currentStage: EnrollmentStage,
): EnrollmentStageWithStatus {
  const index = stageOrder.indexOf(currentStage);
  return index >= 0 && index < stageOrder.length - 1
    ? stageOrder[index + 1]
    : "success";
}
