import { describe, expect, it } from "vitest";
import {
  canRemoveDemoRequest,
  demoRequestProducts,
  matchesDemoRequest,
} from "./requisition-test-seed";

describe("demo request seed safety", () => {
  it("recognizes only the expected operator and four ERP products", () => {
    const request = {
      solicitanteId: 7,
      itens: demoRequestProducts.map(({ codigo }) => ({ item: { codigo } })),
    };
    expect(matchesDemoRequest(request, 7)).toBe(true);
    expect(matchesDemoRequest(request, 8)).toBe(false);
    expect(matchesDemoRequest({ ...request, itens: request.itens.slice(1) }, 7)).toBe(false);
  });

  it("allows removal only before any item is resolved", () => {
    expect(canRemoveDemoRequest({
      status: "ASSUMIDA",
      itens: [{ status: "PENDENTE" }, { status: "ASSUMIDO" }],
    })).toBe(true);
    expect(canRemoveDemoRequest({
      status: "CONCLUIDA",
      itens: [{ status: "SEPARADO" }],
    })).toBe(false);
    expect(canRemoveDemoRequest({
      status: "ASSUMIDA",
      itens: [{ status: "SEPARADO" }],
    })).toBe(false);
  });
});
