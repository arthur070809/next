import { FACE_QUALITY_LIMITS } from "./face-quality";

export function measureFaceFrame(video: CanvasImageSource) {
  const canvas = document.createElement("canvas");
  canvas.width = FACE_QUALITY_LIMITS.lightSampleWidth;
  canvas.height = FACE_QUALITY_LIMITS.lightSampleHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return { brightness: 0, sharpness: 0 };
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let sum = 0;
  let gradient = 0;
  let previous = 0;
  for (let index = 0; index < data.length; index += 4) {
    const luma = 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
    sum += luma;
    if (index > 0) gradient += Math.abs(luma - previous);
    previous = luma;
  }
  const pixelCount = data.length / 4;
  return { brightness: sum / pixelCount, sharpness: gradient / pixelCount };
}
