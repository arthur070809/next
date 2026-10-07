import { describe, expect, it } from "vitest";
import { isFaceDemoPhotoModeEnabled } from "./config";
import {
  decodeFaceDemoPhotoDataUrl,
  getFaceDemoPhotoDimensions,
  getFaceDemoPhotoJpegDimensions,
  isDemoPhotoBadgeAllowed,
} from "./demo-photo";

function tinyJpeg(width = 320, height = 200) {
  return Uint8Array.from([
    0xff, 0xd8,
    0xff, 0xc0, 0x00, 0x11, 0x08,
    height >> 8, height & 0xff, width >> 8, width & 0xff,
    0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
    0xff, 0xd9,
  ]);
}

describe("facial demo photo constraints", () => {
  it("enables the simulated mode only for an explicitly enabled Vercel Preview", () => {
    expect(isFaceDemoPhotoModeEnabled("true", "preview")).toBe(true);
    expect(isFaceDemoPhotoModeEnabled("true", "production")).toBe(false);
    expect(isFaceDemoPhotoModeEnabled("true", undefined)).toBe(false);
    expect(isFaceDemoPhotoModeEnabled("false", "preview")).toBe(false);
  });

  it("resizes dimensions proportionally without exceeding 320 pixels", () => {
    expect(getFaceDemoPhotoDimensions(1920, 1080)).toEqual({ width: 320, height: 180 });
    expect(getFaceDemoPhotoDimensions(240, 160)).toEqual({ width: 240, height: 160 });
    expect(getFaceDemoPhotoDimensions(0, 160)).toBeNull();
  });

  it("accepts only allowlisted numeric badges", () => {
    expect(isDemoPhotoBadgeAllowed("３３３３", "1111,2222,3333")).toBe(true);
    expect(isDemoPhotoBadgeAllowed("a3333", "1111,2222,3333")).toBe(false);
    expect(isDemoPhotoBadgeAllowed("4444", "1111,2222,3333")).toBe(false);
  });

  it("validates the JPEG marker and dimensions from the encoded thumbnail", () => {
    const jpeg = tinyJpeg();
    expect(getFaceDemoPhotoJpegDimensions(jpeg)).toEqual({ width: 320, height: 200 });
    const encoded = `data:image/jpeg;base64,${Buffer.from(jpeg).toString("base64")}`;
    expect(decodeFaceDemoPhotoDataUrl(encoded)).toEqual(jpeg);
    expect(decodeFaceDemoPhotoDataUrl("data:image/jpeg;base64,ZmFrZQ==")).toBeNull();
    expect(decodeFaceDemoPhotoDataUrl(encoded.replace("image/jpeg", "image/png"))).toBeNull();
    expect(decodeFaceDemoPhotoDataUrl(`data:image/jpeg;base64,${Buffer.from(tinyJpeg(321, 200)).toString("base64")}`)).toBeNull();
  });
});
