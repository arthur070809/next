import { describe, expect, it, vi } from "vitest";
import {
  cameraErrorMessage,
  requestScannerStream,
  shouldAcceptScan,
  stopCameraStream,
} from "./camera-utils";

describe("camera scanner helpers", () => {
  it("requests rear camera at high resolution and retries unconstrained on constraint error", async () => {
    const stream = {} as MediaStream;
    const getUserMedia = vi.fn()
      .mockRejectedValueOnce(new DOMException("unsupported", "OverconstrainedError"))
      .mockResolvedValueOnce(stream);

    await expect(requestScannerStream({ getUserMedia }, true)).resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenNthCalledWith(1, {
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    });
    expect(getUserMedia).toHaveBeenNthCalledWith(2, { video: true, audio: false });
  });

  it("reports permission, missing camera, busy camera, and insecure context clearly", async () => {
    expect(cameraErrorMessage(new DOMException("", "NotAllowedError"))).toContain("Permissão");
    expect(cameraErrorMessage(new DOMException("", "NotFoundError"))).toContain("Nenhuma câmera");
    expect(cameraErrorMessage(new DOMException("", "NotReadableError"))).toContain("em uso");
    await expect(requestScannerStream(undefined, false)).rejects.toHaveProperty("name", "SecurityError");
    expect(cameraErrorMessage(new DOMException("", "SecurityError"))).toContain("HTTPS");
  });

  it.each(["NotAllowedError", "NotFoundError"] as const)(
    "propagates getUserMedia failure %s for a clear user-facing message",
    async (name) => {
      const getUserMedia = vi.fn().mockRejectedValue(new DOMException("", name));
      await expect(requestScannerStream({ getUserMedia }, true)).rejects.toHaveProperty("name", name);
      expect(cameraErrorMessage(new DOMException("", name))).toBeTruthy();
    },
  );

  it("does not request a stream when the media API is missing", async () => {
    await expect(requestScannerStream(undefined, true)).rejects.toHaveProperty("name", "NotFoundError");
  });

  it("ignores a repeated scan for two seconds", () => {
    const previous = { value: "129", at: 1000 };
    expect(shouldAcceptScan("129", 2999, previous)).toBe(false);
    expect(shouldAcceptScan("129", 3000, previous)).toBe(true);
    expect(shouldAcceptScan("130", 1500, previous)).toBe(true);
  });

  it("stops every media track when the scanner closes", () => {
    const stop1 = vi.fn();
    const stop2 = vi.fn();
    stopCameraStream({ getTracks: () => [{ stop: stop1 }, { stop: stop2 }] });
    expect(stop1).toHaveBeenCalledOnce();
    expect(stop2).toHaveBeenCalledOnce();
  });
});
