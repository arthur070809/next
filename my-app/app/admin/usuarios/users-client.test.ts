import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const usersClientSource = readFileSync(new URL("./users-client.tsx", import.meta.url), "utf8");

describe("admin badge registration", () => {
  it("uses the shared scanner to fill the cracha field and focus the next field", () => {
    expect(usersClientSource).toContain("<BadgeBarcodeScanner");
    expect(usersClientSource).toContain('id="user-badge"');
    expect(usersClientSource).toContain("cracha: normalizeBadgeCode(value)");
    expect(usersClientSource).toContain("passwordInputRef.current?.focus()");
  });

  it("shows format and API duplicate errors beside the field and prevents Enter submission", () => {
    expect(usersClientSource).toContain("advanceFromBadgeFieldOnEnter(event, passwordInputRef.current)");
    expect(usersClientSource).toContain("O crachá deve conter de 4 a 10 dígitos.");
    expect(usersClientSource).toContain('response.status === 409');
    expect(usersClientSource).toContain('aria-live="polite"');
    expect(usersClientSource).toContain("savingRef.current");
  });
});
