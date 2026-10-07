export const facePhotoMaxFileBytes = 5 * 1024 * 1024;
export const facePhotoMinDataUrlBytes = 1024;
export const facePhotoMaxDataUrlBytes = 2 * 1024 * 1024;
export const facePhotoMaxDimension = 1280;
const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

type FaceBitmap = Pick<ImageBitmap, "width" | "height" | "close">;
type FaceCanvas = {
  width: number;
  height: number;
  getContext(contextId: "2d"): Pick<CanvasRenderingContext2D, "drawImage"> | null;
  toDataURL(type: string, quality?: number): string;
};

export function validateFacePhoto(file: Pick<Blob, "size" | "type">): string | null {
  if (!acceptedImageTypes.has(file.type.toLowerCase())) return "Escolha uma imagem JPG, PNG ou WebP.";
  if (file.size <= 0 || file.size > facePhotoMaxFileBytes) return "A imagem deve ter até 5 MB.";
  return null;
}

function estimatedBase64Bytes(dataUrl: string) {
  const payload = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.floor(payload.length * 3 / 4) - padding;
}

export async function normalizeFacePhoto(
  file: Blob,
  dependencies: {
    createBitmap: (source: Blob, options: ImageBitmapOptions) => Promise<FaceBitmap>;
    createCanvas: () => FaceCanvas;
  } = {
    createBitmap: (source, options) => createImageBitmap(source, options),
    createCanvas: () => document.createElement("canvas"),
  },
): Promise<string> {
  const validationError = validateFacePhoto(file);
  if (validationError) throw new Error(validationError);

  let bitmap: FaceBitmap;
  try {
    bitmap = await dependencies.createBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Não foi possível abrir a foto. Escolha outro arquivo de imagem.");
  }
  try {
    if (!bitmap.width || !bitmap.height) throw new Error("A imagem não contém dimensões válidas.");
    return encodeFacePhoto(bitmap, bitmap.width, bitmap.height, dependencies.createCanvas);
  } finally {
    bitmap.close();
  }
}

export function encodeFacePhoto(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  createCanvas: () => FaceCanvas = () => document.createElement("canvas"),
) {
  if (!sourceWidth || !sourceHeight) throw new Error("A captura não contém dimensões válidas.");
  let scale = Math.min(1, facePhotoMaxDimension / Math.max(sourceWidth, sourceHeight));
  const canvas = createCanvas();
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar a imagem.");
  let undersized = false;

  for (let resizeAttempt = 0; resizeAttempt < 8; resizeAttempt += 1) {
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.9, 0.78, 0.66]) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      const bytes = estimatedBase64Bytes(dataUrl);
      if (bytes >= facePhotoMinDataUrlBytes && bytes <= facePhotoMaxDataUrlBytes) return dataUrl;
      if (bytes < facePhotoMinDataUrlBytes) undersized = true;
    }
    scale *= 0.85;
  }
  if (undersized) throw new Error("A imagem ficou pequena demais para validar. Escolha outra foto.");
  throw new Error("A imagem continua muito grande após a compactação. Escolha outra foto.");
}
