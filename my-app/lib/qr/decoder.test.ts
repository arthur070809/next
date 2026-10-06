import jsQR from "jsqr";
import QRCode from "qrcode";
import { describe, expect, it, vi } from "vitest";
import { createScanner, decodeFrame } from "./decoder";

function renderQr(text: string) {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const quietZone = 4;
  const scale = 8;
  const width = (qr.modules.size + quietZone * 2) * scale;
  const data = new Uint8ClampedArray(width * width * 4);
  data.fill(255);

  for (let row = 0; row < qr.modules.size; row += 1) {
    for (let column = 0; column < qr.modules.size; column += 1) {
      if (qr.modules.data[row * qr.modules.size + column] === 0) continue;
      for (let y = 0; y < scale; y += 1) {
        for (let x = 0; x < scale; x += 1) {
          const px = (column + quietZone) * scale + x;
          const py = (row + quietZone) * scale + y;
          const offset = (py * width + px) * 4;
          data[offset] = 0;
          data[offset + 1] = 0;
          data[offset + 2] = 0;
          data[offset + 3] = 255;
        }
      }
    }
  }
  return { data, width, height: width } as ImageData;
}

describe("QR decoder", () => {
  it.each(["129", "128", "127", "173", "7988", "17940", "1794", "1796", "1795", "5746"])("round-trips an offline QR for %s", (text) => {
    expect(decodeFrame(renderQr(text), jsQR)).toBe(text);
  });

  it("does not decode a blank frame", () => {
    const blank = { data: new Uint8ClampedArray(4 * 20 * 20).fill(255), width: 20, height: 20 } as ImageData;
    expect(decodeFrame(blank, jsQR)).toBeNull();
  });

  it("does not decode before video dimensions are ready and cancels on stop", async () => {
    let scheduled: FrameRequestCallback | undefined;
    const cancelFrame = vi.fn();
    const scanner = createScanner(
      { readyState: 0, videoWidth: 0, videoHeight: 0 } as HTMLVideoElement,
      { onDecode: vi.fn(), onDiagnostics: vi.fn() },
      {
        requestFrame: (callback) => {
          scheduled = callback;
          return 7;
        },
        cancelFrame,
        loadJsQr: async () => vi.fn(() => null),
        getNativeDetector: async () => null,
        createCanvas: () => ({ getContext: () => null }) as unknown as HTMLCanvasElement,
        now: () => 1000,
      },
    );

    await scanner.start();
    scheduled?.(1000);
    expect(scanner.getDiagnostics().framesRead).toBe(0);
    scanner.stop();
    expect(cancelFrame).toHaveBeenCalledWith(7);
  });

  it("falls back to jsqr when the native detector fails", async () => {
    vi.stubGlobal("HTMLMediaElement", { HAVE_CURRENT_DATA: 2 });
    const frames: FrameRequestCallback[] = [];
    const jsqrDecoder = vi.fn(() => null);
    const getImageData = vi.fn(() => ({
      data: new Uint8ClampedArray(4 * 20 * 20).fill(255),
      width: 20,
      height: 20,
    }) as ImageData);
    const scanner = createScanner(
      { readyState: 2, videoWidth: 20, videoHeight: 20 } as HTMLVideoElement,
      { onDecode: vi.fn(), onDiagnostics: vi.fn() },
      {
        requestFrame: (callback) => {
          frames.push(callback);
          return frames.length;
        },
        cancelFrame: vi.fn(),
        loadJsQr: async () => jsqrDecoder,
        getNativeDetector: async () => ({
          detect: async () => {
            throw new Error("native detector failed");
          },
        }),
        createCanvas: () => ({
          getContext: () => ({ drawImage: vi.fn(), getImageData }),
        }) as unknown as HTMLCanvasElement,
        now: () => 1000,
      },
    );

    try {
      await scanner.start();
      frames[0](1000);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(scanner.getDiagnostics().decoder).toBe("jsqr");
      frames[frames.length - 1](1200);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(jsqrDecoder).toHaveBeenCalled();
    } finally {
      scanner.stop();
      vi.unstubAllGlobals();
    }
  });
});
