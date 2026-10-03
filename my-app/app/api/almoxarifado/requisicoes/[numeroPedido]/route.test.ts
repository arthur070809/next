import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedFuncionario: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    funcionario: { findFirst: vi.fn() },
    requisicao: { updateMany: vi.fn(), findUnique: vi.fn() },
    requisicaoItem: { updateMany: vi.fn() },
    auditoria: { create: vi.fn() },
  },
}));

import { PATCH } from "./route";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PapelFuncionario, StatusRequisicao } from "@/generated/prisma/client";

const stockkeeper = { id: 8, papel: PapelFuncionario.ALMOXARIFE };

function claimRequest(codigoCracha = "2222") {
  return new Request("http://localhost/api/almoxarifado/requisicoes/REQ-1", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
    },
    body: JSON.stringify({ action: "assumir", codigoCracha }),
  });
}

function context(numeroPedido = "REQ-1") {
  return { params: Promise.resolve({ numeroPedido }) };
}

describe("atomic request claiming", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue(stockkeeper as never);
    vi.mocked(prisma.$transaction).mockImplementation(
      ((callback: (transaction: typeof prisma) => Promise<unknown>) => callback(prisma)) as never,
    );
    vi.mocked(prisma.funcionario.findFirst).mockResolvedValue({
      id: stockkeeper.id,
      nome: "Almoxarife",
      papel: stockkeeper.papel,
    } as never);
    vi.mocked(prisma.requisicao.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.requisicaoItem.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.auditoria.create).mockResolvedValue({} as never);
    vi.mocked(prisma.requisicao.findUnique).mockResolvedValue(null as never);
  });

  it("claims a pending request through a conditional status update", async () => {
    const response = await PATCH(claimRequest(), context());

    expect(response.status).toBe(200);
    expect(prisma.requisicao.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { numeroPedido: "REQ-1", status: StatusRequisicao.PENDENTE },
      data: expect.objectContaining({ status: StatusRequisicao.ASSUMIDA, atendenteId: stockkeeper.id }),
    }));
    expect(prisma.auditoria.create).toHaveBeenCalledTimes(1);
  });

  it("returns the winner name when a concurrent claim already changed the status", async () => {
    vi.mocked(prisma.requisicao.updateMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.requisicao.findUnique).mockResolvedValue({
      status: StatusRequisicao.ASSUMIDA,
      atendente: { nome: "Outro almoxarife" },
    } as never);

    const response = await PATCH(claimRequest(), context());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("Outro almoxarife");
    expect(prisma.requisicaoItem.updateMany).not.toHaveBeenCalled();
  });

  it("blocks an operator before attempting the conditional update", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue({
      id: 9,
      papel: PapelFuncionario.OPERADOR,
    } as never);

    const response = await PATCH(claimRequest(), context());

    expect(response.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.requisicao.updateMany).not.toHaveBeenCalled();
  });

  it("returns not found when no request exists", async () => {
    vi.mocked(prisma.requisicao.updateMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.requisicao.findUnique).mockResolvedValue(null as never);

    const response = await PATCH(claimRequest(), context("REQ-MISSING"));

    expect(response.status).toBe(404);
  });
});
