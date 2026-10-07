import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const loginFormSource = readFileSync(new URL("./LoginForm.tsx", import.meta.url), "utf8");

describe("login form capabilities", () => {
  it("does not provide gallery or file upload for login facial verification", () => {
    expect(loginFormSource).not.toMatch(/type\s*=\s*["']file["']/i);
    expect(loginFormSource).toContain("getUserMedia");
    expect(loginFormSource).toContain("/api/auth/login/face/verify");
  });
});
