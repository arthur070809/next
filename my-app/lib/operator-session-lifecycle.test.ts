import { describe, expect, it } from "vitest";
import {
  OPERATOR_RETURN_GRACE_MS,
  shouldEndOperatorSessionOnReturn,
  shouldSendOperatorPagehideLogout,
} from "./operator-session-lifecycle";

describe("operator app-close lifecycle", () => {
  it("honors the return grace period and expires once it is reached", () => {
    const hiddenAt = 1_000_000;
    expect(shouldEndOperatorSessionOnReturn("operador", hiddenAt, hiddenAt + OPERATOR_RETURN_GRACE_MS - 1, false)).toBe(false);
    expect(shouldEndOperatorSessionOnReturn("operador", hiddenAt, hiddenAt + OPERATOR_RETURN_GRACE_MS, false)).toBe(true);
  });

  it("does not end a session when the QR camera or permission prompt is active", () => {
    expect(shouldEndOperatorSessionOnReturn("operador", 1_000, 100_000, true)).toBe(false);
    expect(shouldSendOperatorPagehideLogout("operador", true, false)).toBe(false);
  });

  it("does not change logout behavior for warehouse or admin profiles", () => {
    expect(shouldEndOperatorSessionOnReturn("admin", 1_000, 100_000, false)).toBe(false);
    expect(shouldEndOperatorSessionOnReturn("almoxarifado", 1_000, 100_000, false)).toBe(false);
    expect(shouldSendOperatorPagehideLogout("admin", false, false)).toBe(false);
    expect(shouldSendOperatorPagehideLogout("almoxarifado", false, false)).toBe(false);
  });

  it("uses best-effort pagehide logout unless the document enters the back-forward cache", () => {
    expect(shouldSendOperatorPagehideLogout("operador", false, false)).toBe(true);
    expect(shouldSendOperatorPagehideLogout("operador", false, true)).toBe(false);
  });
});
