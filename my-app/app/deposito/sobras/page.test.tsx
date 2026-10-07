import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedFuncionario: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }) }));

import { PapelFuncionario } from "@/generated/prisma/client";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { redirect } from "next/navigation";
import SobrasPage from "./page";
import SobrasClient from "./SobrasClient";

describe("surplus page access", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([PapelFuncionario.ADMIN, PapelFuncionario.ALMOXARIFE])("renders the read-only view for %s", async (papel) => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue({ id: 7, papel } as never);
    const result = await SobrasPage();
    expect(result.type).toBe(SobrasClient);
  });

  it("redirects an operator before rendering the client page", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue({ id: 8, papel: PapelFuncionario.OPERADOR } as never);
    await expect(SobrasPage()).rejects.toThrow("redirect:/requisicao");
    expect(redirect).toHaveBeenCalledWith("/requisicao");
  });

  it("redirects unauthenticated users to login", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue(null);
    await expect(SobrasPage()).rejects.toThrow("redirect:/login?callbackUrl=%2Fdeposito%2Fsobras");
  });
});
