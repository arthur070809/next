import { describe, expect, it, vi } from "vitest";
import {
  facePhotoMaxDataUrlBytes,
  facePhotoMaxDimension,
  facePhotoMaxFileBytes,
  facePhotoMinDataUrlBytes,
  encodeFacePhoto,
  encodeFaceEnrollmentFrame,
  faceEnrollmentFrameMaxBytes,
  normalizeFacePhoto,
  validateFacePhoto,
} from "./photo";

function makeDependencies({
  width = 640,
  height = 480,
  encodedBytes = 100_000,
  contextAvailable = true,
}: {
  width?: number;
  height?: number;
  encodedBytes?: number;
  contextAvailable?: boolean;
} = {}) {
  const close = vi.fn();
  const drawImage = vi.fn();
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => contextAvailable ? { drawImage } : null),
    toDataURL: vi.fn(() => `data:image/jpeg;base64,${"A".repeat(Math.ceil(encodedBytes * 4 / 3))}`),
  };
  const createBitmap = vi.fn(async () => ({ width, height, close }));
  return {
    dependencies: {
      createBitmap,
      createCanvas: () => canvas,
    },
    canvas,
    close,
    drawImage,
    createBitmap,
  };
}

describe("facial photo input", () => {
  it("accepts only supported image types and files up to 5 MB", () => {
    expect(validateFacePhoto({ type: "image/jpeg", size: 1024 })).toBeNull();
    expect(validateFacePhoto({ type: "image/png", size: facePhotoMaxFileBytes })).toBeNull();
    expect(validateFacePhoto({ type: "application/pdf", size: 1024 })).toContain("JPG, PNG ou WebP");
    expect(validateFacePhoto({ type: "image/jpeg", size: facePhotoMaxFileBytes + 1 })).toContain("5 MB");
    expect(validateFacePhoto({ type: "image/jpeg", size: 0 })).toContain("5 MB");
  });

  it("normalizes orientation, bounds dimensions, and closes the bitmap", async () => {
    const { dependencies, canvas, close, drawImage, createBitmap } = makeDependencies({
      width: 4000,
      height: 2000,
    });
    const image = await normalizeFacePhoto(
      new Blob(["x".repeat(1024)], { type: "image/jpeg" }),
      dependencies,
    );

    expect(createBitmap).toHaveBeenCalledWith(
      expect.any(Blob),
      { imageOrientation: "from-image" },
    );
    expect(canvas.width).toBe(facePhotoMaxDimension);
    expect(canvas.height).toBe(facePhotoMaxDimension / 2);
    expect(drawImage).toHaveBeenCalledOnce();
    expect(image).toMatch(/^data:image\/jpeg;base64,/);
    expect(close).toHaveBeenCalledOnce();
  });

  it("retries compression and refuses output larger than the server limit", async () => {
    const { dependencies, canvas, close } = makeDependencies({
      encodedBytes: facePhotoMaxDataUrlBytes + 1,
    });
    await expect(normalizeFacePhoto(
      new Blob(["x".repeat(1024)], { type: "image/jpeg" }),
      dependencies,
    )).rejects.toThrow("continua muito grande");
    expect(canvas.toDataURL).toHaveBeenCalledTimes(24);
    expect(close).toHaveBeenCalledOnce();
  });

  it("reports a missing canvas context without leaking the decoded bitmap", async () => {
    const { dependencies, close } = makeDependencies({ contextAvailable: false });
    await expect(normalizeFacePhoto(
      new Blob(["x".repeat(1024)], { type: "image/png" }),
      dependencies,
    )).rejects.toThrow("preparar a imagem");
    expect(close).toHaveBeenCalledOnce();
  });

  it("applies the server image-size bounds to manual camera captures too", () => {
    const small = makeDependencies({ encodedBytes: facePhotoMinDataUrlBytes - 1 });
    expect(() => encodeFacePhoto({} as CanvasImageSource, 1280, 720, small.dependencies.createCanvas))
      .toThrow("pequena demais");

    const withinBounds = makeDependencies({ encodedBytes: facePhotoMinDataUrlBytes });
    expect(encodeFacePhoto({} as CanvasImageSource, 1280, 720, withinBounds.dependencies.createCanvas))
      .toMatch(/^data:image\/jpeg;base64,/);
  });

  it("keeps each automatic enrollment frame under the serverless payload budget", () => {
    const withinBounds = makeDependencies({ encodedBytes: faceEnrollmentFrameMaxBytes });
    expect(encodeFaceEnrollmentFrame(
      {} as CanvasImageSource,
      1280,
      720,
      withinBounds.dependencies.createCanvas,
    )).toMatch(/^data:image\/jpeg;base64,/);

    const tooLarge = makeDependencies({ encodedBytes: faceEnrollmentFrameMaxBytes + 1 });
    expect(() => encodeFaceEnrollmentFrame(
      {} as CanvasImageSource,
      1280,
      720,
      tooLarge.dependencies.createCanvas,
    )).toThrow("continua muito grande");
  });
});
