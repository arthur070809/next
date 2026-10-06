import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedFuncionario: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    localEstoque: { upsert: vi.fn() },
    item: { findUnique: vi.fn(), findFirst: vi.fn() },
    requisicao: { findUnique: vi.fn() },
    movimentacao: { aggregate: vi.fn() },
  },
}));
vi.mock("@/lib/security", () => ({ isSameOrigin: vi.fn(() => true) }));
vi.mock("@/lib/requisicoes-db", () => ({
  criarRequisicaoIdempotente: vi.fn(),
  toRequisicaoMock: vi.fn(() => ({ numeroPedido: "REQ-000010" })),
}));

import { GET, POST } from "./route";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { criarRequisicaoIdempotente } from "@/lib/requisicoes-db";
import { PapelFuncionario } from "@/generated/prisma/client";

const badge = "10000000-0000-4000-8000-000000000001";

function request(
  headers: Record<string, string> = { "Idempotency-Key": badge },
  itemOverrides: Record<string, unknown> = {},
) {
  return new Request("http://localhost/api/requests", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
      ...headers,
    },
    body: JSON.stringify({
      itens: [{
        itemId: "item-1",
        setor: "setor3",
        quantidade: 2,
        unidadeMedida: "un",
        descricao: "Para montagem",
        prioridade: "padrao",
        ...itemOverrides,
      }],
    }),
  });
}

describe("POST /api/requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValue({
      id: 12,
      papel: PapelFuncionario.OPERADOR,
    } as never);
    vi.mocked(prisma.localEstoque.upsert).mockResolvedValue({ id: "local-1" } as never);
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      id: "item-1",
      nome: "Arruela",
      unidade: "un",
    } as never);
    vi.mocked(criarRequisicaoIdempotente).mockResolvedValue({
      requisicao: { numeroPedido: "REQ-000010" },
      replayed: false,
    } as never);
  });

  describe("GET /api/requests return lookup", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(getAuthenticatedFuncionario).mockResolvedValue({
        id: 12,
        papel: PapelFuncionario.ALMOXARIFE,
      } as never);
      vi.mocked(prisma.requisicao.findUnique).mockResolvedValue({
        id: "request-id",
        numeroPedido: "REQ-000010",
        status: "CONCLUIDA",
        itens: [{
          id: "request-item-id",
          itemId: "item-1",
          quantidade: 4,
          item: { nome: "Arruela" },
        }],
      } as never);
      vi.mocked(prisma.movimentacao.aggregate).mockResolvedValue({ _sum: { quantidade: 1 } } as never);
    });

    it("returns the selected completed request item and prior deposit returns", async () => {
      const response = await GET(new Request("http://localhost/api/requests?numero=REQ-000010&itemId=item-1"));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        requisicao: {
          id: "request-id",
          numero: "REQ-000010",
          item: "Arruela",
          estoqueItemId: "item-1",
          quantidade: 4,
          qtdDevolvida: 1,
          status: "RETIRADA",
        },
      });
      expect(prisma.movimentacao.aggregate).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ requisicaoItemId: "request-item-id", tipo: "ENTRADA" }),
      }));
    });

    it("limits return lookup to warehouse staff", async () => {
      vi.mocked(getAuthenticatedFuncionario).mockResolvedValueOnce({
        id: 12,
        papel: PapelFuncionario.OPERADOR,
      } as never);
      const response = await GET(new Request("http://localhost/api/requests?numero=REQ-000010&itemId=item-1"));
      expect(response.status).toBe(403);
      expect(prisma.requisicao.findUnique).not.toHaveBeenCalled();
    });
  });

  it("persists the selected sector and supplies hashed idempotency fingerprints", async () => {
    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.numeroPedido).toBe("REQ-000010");
    const call = vi.mocked(criarRequisicaoIdempotente).mock.calls[0][0];
    expect(call.itens[0].descricao).toBe("[[setor:v1:setor3]]\nPara montagem");
    expect(call.idempotencyKeyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(call.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(call.idempotencyKeyHash).not.toBe(badge);
  });

  it("accepts a standard request without a description", async () => {
    const response = await POST(request({ "Idempotency-Key": badge }, { descricao: "" }));

    expect(response.status).toBe(201);
    expect(criarRequisicaoIdempotente).toHaveBeenCalled();
  });

  it("requires a description for a priority request on the server", async () => {
    const response = await POST(request(
      { "Idempotency-Key": badge },
      { prioridade: "prioridade", descricao: "  " },
    ));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("prioritários");
    expect(criarRequisicaoIdempotente).not.toHaveBeenCalled();
  });

  it("accepts a priority request when a description is supplied", async () => {
    const response = await POST(request(
      { "Idempotency-Key": badge },
      { prioridade: "prioridade", descricao: "Parada de máquina" },
    ));

    expect(response.status).toBe(201);
    expect(criarRequisicaoIdempotente).toHaveBeenCalledWith(expect.objectContaining({
      prioridade: "prioridade",
      itens: [expect.objectContaining({ descricao: "[[setor:v1:setor3]]\nParada de máquina" })],
    }));
  });

  it("returns the original request for an idempotent replay", async () => {
    vi.mocked(criarRequisicaoIdempotente).mockResolvedValue({
      requisicao: { numeroPedido: "REQ-000010" },
      replayed: true,
    } as never);

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect((await response.json()).replayed).toBe(true);
  });

  it("rejects requests without a valid idempotency key", async () => {
    const response = await POST(request({}));

    expect(response.status).toBe(400);
    expect(prisma.localEstoque.upsert).not.toHaveBeenCalled();
    expect(criarRequisicaoIdempotente).not.toHaveBeenCalled();
  });

  it("requires authentication when listing requests", async () => {
    vi.mocked(getAuthenticatedFuncionario).mockResolvedValueOnce(null);
    const response = await GET(new Request("http://localhost/api/requests"));

    expect(response.status).toBe(401);
  });

  it("rejects an invalid request payload", async () => {
    const response = await POST(new Request("http://localhost/api/requests", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost",
        "Idempotency-Key": badge,
      },
      body: JSON.stringify({}),
    }));

    expect(response.status).toBe(400);
  });
});
