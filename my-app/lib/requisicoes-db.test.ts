import { beforeEach, describe, expect, it, vi } from "vitest";

let reservada = 0;
const transactionMock = {
  $executeRaw: vi.fn(),
  $queryRaw: vi.fn(),
  saldoEstoque: { findUnique: vi.fn() },
  requisicao: { create: vi.fn() },
  movimentacao: { create: vi.fn() },
};
const transactionRunner = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: (...args: unknown[]) => transactionRunner(...args) },
}));

import { criarRequisicao } from "./requisicoes-db";

describe("criarRequisicao reserva de estoque", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reservada = 0;
    transactionMock.$executeRaw.mockImplementation(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join(" ");
      if (sql.includes("sequencia_requisicao")) return 1;
      if (sql.includes("saldos_estoque")) {
        const quantity = Number(values[0]);
        if (10 - reservada < quantity) return 0;
        reservada += quantity;
        return 1;
      }
      return 0;
    });
    transactionMock.$queryRaw.mockResolvedValue([{ proximo: 42 }]);
    transactionMock.saldoEstoque.findUnique.mockImplementation(async () => ({
      id: "stock-1",
      quantidade: 10,
      reservada,
      item: { nome: "Arruela" },
    }));
    transactionMock.requisicao.create.mockImplementation(async ({ data }: { data: { solicitanteId: number; prioridade?: string; observacao?: string | null; itens: { create: Array<{ itemId: string; localId: string; quantidade: number; unidadeMedida: string; descricao: string | null; status: string }> } } }) => ({
      id: "request-1",
      numeroPedido: "REQ-000041",
      status: "PENDENTE",
      prioridade: data.prioridade ?? "PADRAO",
      observacao: data.observacao,
      solicitanteId: data.solicitanteId,
      atendenteId: null,
      criadoEm: new Date("2026-10-04T00:00:00Z"),
      assumidaEm: null,
      concluidaEm: null,
      anuladaEm: null,
      atualizadoEm: new Date("2026-10-04T00:00:00Z"),
      solicitante: { nome: "Operador", cracha: "1001" },
      atendente: null,
      itens: data.itens.create.map((item, index) => ({
        ...item,
        id: `request-item-${index + 1}`,
        requisicaoId: "request-1",
        item: { nome: "Arruela" },
        local: { slug: "estoque" },
      })),
    }));
    transactionMock.movimentacao.create.mockResolvedValue({ id: "movement-1" });
    transactionRunner.mockImplementation(async (callback: (tx: typeof transactionMock) => Promise<unknown>) => {
      const before = reservada;
      try {
        return await callback(transactionMock);
      } catch (error) {
        reservada = before;
        throw error;
      }
    });
  });

  it("cria requisição e reserva dentro da mesma transação", async () => {
    await criarRequisicao({
      solicitanteId: 1,
      itens: [{ itemId: "item-1", localId: "local-1", quantidade: 3 }],
    });

    expect(transactionRunner).toHaveBeenCalledOnce();
    expect(reservada).toBe(3);
    expect(transactionMock.requisicao.create).toHaveBeenCalledOnce();
    expect(transactionMock.movimentacao.create).toHaveBeenCalledOnce();
  });

  it("reverte reserva anterior se outro item falhar dentro da transação", async () => {
    await expect(criarRequisicao({
      solicitanteId: 1,
      itens: [
        { itemId: "item-1", localId: "local-1", quantidade: 3 },
        { itemId: "item-2", localId: "local-1", quantidade: 8 },
      ],
    })).rejects.toMatchObject({ code: "SALDO_INSUFICIENTE" });

    expect(reservada).toBe(0);
    expect(transactionMock.requisicao.create).not.toHaveBeenCalled();
    expect(transactionMock.movimentacao.create).not.toHaveBeenCalled();
  });
});
