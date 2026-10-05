import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthenticatedFuncionario: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    localEstoque: { upsert: vi.fn() },
    item: { findUnique: vi.fn(), findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/requisicoes-db", () => ({
  criarRequisicaoIdempotente: vi.fn(),
  toRequisicaoMock: vi.fn(() => ({ numeroPedido: "REQ-000010" })),
}));

import { POST } from "./route";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { criarRequisicaoIdempotente } from "@/lib/requisicoes-db";
import { PapelFuncionario } from "@/generated/prisma/client";

const badge = "10000000-0000-4000-8000-000000000001";

function request(headers: Record<string, string> = { "Idempotency-Key": badge }) {
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
});
