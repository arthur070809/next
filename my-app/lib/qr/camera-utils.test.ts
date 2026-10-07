import { describe, expect, it, vi } from "vitest";
import {
  cameraErrorMessage,
  createCameraLease,
  createScannerSession,
  SCANNER_SUCCESS_FEEDBACK_MS,
  requestScannerStream,
  shouldCloseCamera,
  shouldAcceptScan,
  stopCameraStream,
} from "./camera-utils";

describe("camera scanner helpers", () => {
  it.each([
    ["confirmed", true],
    ["already-confirmed", true],
    ["wrong-item", false],
    ["invalid-format", false],
    ["error", false],
  ] as const)("closes the camera for %s outcomes according to the decision table", (kind, expected) => {
    expect(shouldCloseCamera(kind)).toBe(expected);
  });

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
    expect(cameraErrorMessage(new DOMException("", "OverconstrainedError"))).toContain("não suporta");
    expect(cameraErrorMessage(new DOMException("", "AbortError"))).toContain("interrompida");
    expect(cameraErrorMessage(new TypeError("missing API"))).toContain("navegador");
    await expect(requestScannerStream(undefined, false)).rejects.toHaveProperty("name", "SecurityError");
    expect(cameraErrorMessage(new DOMException("", "SecurityError"))).toContain("HTTPS");
  });

  it("explains that embedded social-media browsers must open the link externally", () => {
    const message = cameraErrorMessage(
      new DOMException("", "NotAllowedError"),
      "Mozilla/5.0 Instagram 300.0.0 Android",
    );
    expect(message).toContain("Instagram");
    expect(message).toContain("navegador");
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

  it("keeps async camera streams owned by their mount during a StrictMode remount", () => {
    const firstMount = createCameraLease();
    const secondMount = createCameraLease();
    const stopLateStream = vi.fn();
    const stopCurrentStream = vi.fn();

    firstMount.close();
    expect(firstMount.attach({ getTracks: () => [{ stop: stopLateStream }] })).toBe(false);
    expect(secondMount.attach({ getTracks: () => [{ stop: stopCurrentStream }] })).toBe(true);
    expect(firstMount.isActive()).toBe(false);
    expect(secondMount.isActive()).toBe(true);
    expect(stopLateStream).toHaveBeenCalledOnce();
    expect(stopCurrentStream).not.toHaveBeenCalled();
    secondMount.close();
    expect(stopCurrentStream).toHaveBeenCalledOnce();
  });

  it("stops tracks, clears the video, cancels scanning, and closes after success feedback", () => {
    vi.useFakeTimers();
    try {
      const stopTrack1 = vi.fn();
      const stopTrack2 = vi.fn();
      const stream = { getTracks: () => [{ stop: stopTrack1 }, { stop: stopTrack2 }] };
      const lease = createCameraLease();
      lease.attach(stream);
      const video = { srcObject: stream };
      const stopScanner = vi.fn();
      const setActive = vi.fn();
      const onClose = vi.fn();
      const session = createScannerSession(video, lease, setActive, onClose);
      session.setScanner({ stop: stopScanner });

      expect(session.completeRead(true)).toBe(true);
      expect(stopTrack1).not.toHaveBeenCalled();
      expect(stopScanner).not.toHaveBeenCalled();
      expect(video.srcObject).toBe(stream);
      expect(onClose).not.toHaveBeenCalled();

      vi.advanceTimersByTime(SCANNER_SUCCESS_FEEDBACK_MS - 1);
      expect(onClose).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(stopTrack1).toHaveBeenCalledOnce();
      expect(stopTrack2).toHaveBeenCalledOnce();
      expect(stopScanner).toHaveBeenCalledOnce();
      expect(video.srcObject).toBeNull();
      expect(setActive).toHaveBeenLastCalledWith(false);
      expect(onClose).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    "Este item não está nesta requisição: 130 · Outro material.",
    "QR não reconhecido: formato desconhecido.",
  ])("keeps the camera open after an unsuccessful result: %s", () => {
    vi.useFakeTimers();
    try {
      const stopTrack = vi.fn();
      const stream = { getTracks: () => [{ stop: stopTrack }] };
      const lease = createCameraLease();
      lease.attach(stream);
      const onClose = vi.fn();
      const session = createScannerSession({ srcObject: stream }, lease, vi.fn(), onClose);

      expect(session.completeRead(false)).toBe(false);
      vi.advanceTimersByTime(SCANNER_SUCCESS_FEEDBACK_MS * 2);
      expect(stopTrack).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("resolves a successful QR only once even if the decoder calls back repeatedly", () => {
    vi.useFakeTimers();
    try {
      const onClose = vi.fn();
      const lease = createCameraLease();
      const session = createScannerSession({ srcObject: null }, lease, vi.fn(), onClose);

      expect(session.completeRead(true)).toBe(true);
      expect(session.completeRead(true)).toBe(false);
      vi.advanceTimersByTime(SCANNER_SUCCESS_FEEDBACK_MS);
      expect(onClose).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens a fresh camera session after a completed session closes", () => {
    vi.useFakeTimers();
    try {
      const firstStop = vi.fn();
      const firstLease = createCameraLease();
      firstLease.attach({ getTracks: () => [{ stop: firstStop }] });
      const first = createScannerSession({ srcObject: null }, firstLease, vi.fn(), vi.fn());
      first.completeRead(true);
      vi.advanceTimersByTime(SCANNER_SUCCESS_FEEDBACK_MS);

      const secondStop = vi.fn();
      const secondLease = createCameraLease();
      const secondStream = { getTracks: () => [{ stop: secondStop }] };
      expect(secondLease.attach(secondStream)).toBe(true);
      const second = createScannerSession({ srcObject: secondStream }, secondLease, vi.fn(), vi.fn());
      expect(second.isClosed()).toBe(false);
      expect(second.completeRead(true)).toBe(true);
      expect(firstStop).toHaveBeenCalledOnce();
      expect(secondStop).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("releases the camera and scanner safely when unmounted during a read", () => {
    const stopTrack = vi.fn();
    const stream = { getTracks: () => [{ stop: stopTrack }] };
    const lease = createCameraLease();
    lease.attach(stream);
    const video = { srcObject: stream };
    const stopScanner = vi.fn();
    const onClose = vi.fn();
    const session = createScannerSession(video, lease, vi.fn(), onClose);
    session.setScanner({ stop: stopScanner });
    session.dispose();

    expect(() => session.dispose()).not.toThrow();
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(stopScanner).toHaveBeenCalledOnce();
    expect(video.srcObject).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("clears the active-scanner marker when closed automatically", () => {
    vi.useFakeTimers();
    try {
      const activeChanges: boolean[] = [];
      const lease = createCameraLease();
      const session = createScannerSession(
        { srcObject: null },
        lease,
        (active) => activeChanges.push(active),
        vi.fn(),
      );
      session.completeRead(true);
      vi.advanceTimersByTime(SCANNER_SUCCESS_FEEDBACK_MS);
      expect(activeChanges).toEqual([false]);
    } finally {
      vi.useRealTimers();
    }
  });
});
