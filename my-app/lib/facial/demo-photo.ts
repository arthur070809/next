export const faceDemoPhotoMaximumDimension = 320;
export const faceDemoPhotoQuality = 0.6;
export const faceDemoPhotoMaximumBytes = 192 * 1024;

export function isDemoPhotoBadgeAllowed(
  badge: string,
  configuredBadges = process.env.LOGIN_DEMO_CRACHAS ?? "",
) {
  const normalizedBadge = normalizeLoginCode(badge);
  return /^\d{4,10}$/.test(normalizedBadge) && configuredBadges
    .split(",")
    .map((item) => normalizeLoginCode(item))
    .some((item) => item === normalizedBadge);
}

export function getFaceDemoPhotoDimensions(width: number, height: number, maximum = faceDemoPhotoMaximumDimension) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const scale = Math.min(1, maximum / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function captureFaceDemoPhoto(video: HTMLVideoElement) {
  const dimensions = getFaceDemoPhotoDimensions(video.videoWidth, video.videoHeight);
  if (!dimensions) throw new Error("A câmera ainda não forneceu um quadro.");
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível capturar o quadro.");
  context.drawImage(video, 0, 0, dimensions.width, dimensions.height);
  return canvas.toDataURL("image/jpeg", faceDemoPhotoQuality);
}

export function decodeFaceDemoPhotoDataUrl(value: unknown): Uint8Array | null {
  if (typeof value !== "string" || value.length > Math.ceil(faceDemoPhotoMaximumBytes * 4 / 3) + 64) return null;
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return null;
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(match[1]), (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
  if (bytes.length < 4 || bytes.length > faceDemoPhotoMaximumBytes || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const dimensions = getFaceDemoPhotoJpegDimensions(bytes);
  if (!dimensions || Math.max(dimensions.width, dimensions.height) > faceDemoPhotoMaximumDimension) return null;
  return bytes;
}

export function getFaceDemoPhotoJpegDimensions(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd9 || marker === 0xda) return null;
    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
    if (startOfFrame.has(marker)) {
      if (segmentLength < 8) return null;
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      return width > 0 && height > 0 ? { width, height } : null;
    }
    offset += segmentLength;
  }
  return null;
}
import { normalizeLoginCode } from "@/lib/normalize-login-code";
