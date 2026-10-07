import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const loginFormSource = readFileSync(new URL("./LoginForm.tsx", import.meta.url), "utf8");

describe("login form capabilities", () => {
  it("does not provide gallery or file upload for login facial verification", () => {
    expect(loginFormSource).not.toMatch(/type\s*=\s*["']file["']/i);
    expect(loginFormSource).toContain("createCameraStreamController");
    expect(loginFormSource).toContain("camera.start(");
    expect(loginFormSource).toContain("/api/auth/login/face/verify");
  });

  it("starts login attempts automatically with bounded retries and no manual verify control", () => {
    expect(loginFormSource).toContain("submitAutomaticFaceAttempt");
    expect(loginFormSource).toContain("canStartAutomaticAttempt");
    expect(loginFormSource).toContain("requestFreshFaceChallenge");
    expect(loginFormSource).not.toContain("enableCamera()");
    expect(loginFormSource).not.toContain("onSubmit={(event) => void submitFace");
  });
});
