import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const loginFormSource = readFileSync(new URL("./LoginForm.tsx", import.meta.url), "utf8");

describe("login form", () => {
  it("keeps badge/password authentication, administrator TOTP and WebAuthn", () => {
    expect(loginFormSource).toContain("/api/auth/login");
    expect(loginFormSource).toContain("/api/auth/login/totp");
    expect(loginFormSource).toContain("/api/auth/login/webauthn/verify");
    expect(loginFormSource).toContain("Verificação em duas etapas");
    expect(loginFormSource).toContain("Entrar com senha");
  });

  it("only opens a face challenge when the login API requires it", () => {
    expect(loginFormSource).toContain('data.step === "face"');
    expect(loginFormSource).toContain('setStage("face")');
    expect(loginFormSource).not.toContain("startFaceLogin");
    expect(loginFormSource).not.toContain("Entrar com reconhecimento facial");
    expect(loginFormSource).not.toContain("Modo demonstração: reconhecimento simulado");
  });

  it("uses the shared badge scanner and moves scanner/keyboard input to the password field", () => {
    expect(loginFormSource).toContain("<BadgeBarcodeScanner");
    expect(loginFormSource).toContain("isValidBadgeCode");
    expect(loginFormSource).toContain("setCodigoCracha(value)");
    expect(loginFormSource).toContain("passwordInputRef.current?.focus()");
    expect(loginFormSource).toContain("advanceFromBadgeFieldOnEnter(event, passwordInputRef.current)");
    expect(loginFormSource).toContain("normalizeBadgeCode(codigoCracha)");
  });
});
