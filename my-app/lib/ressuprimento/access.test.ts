import { describe, expect, it } from "vitest";
import { autorizarRessuprimento } from "./access";

describe("acesso ao ressuprimento", () => {
  it("bloqueia sessão ausente, OPERADOR e ALMOXARIFE", () => {
    expect(autorizarRessuprimento(null)).toEqual({ allowed: false, status: 401 });
    expect(autorizarRessuprimento({ role: "operador" })).toEqual({
      allowed: false,
      status: 403,
    });
    expect(autorizarRessuprimento({ role: "almoxarife" })).toEqual({
      allowed: false,
      status: 403,
    });
  });

  it("permite somente ADMIN", () => {
    expect(autorizarRessuprimento({ role: "admin" })).toEqual({ allowed: true });
  });
});
