import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: vi.fn() } }));

import { criarRequisicaoIdempotente } from "./requisicoes-db";
import { prisma } from "@/lib/prisma";

const keyHash = "a".repeat(64);
const payloadHash = "b".repeat(64);
const existingRequest = {
  observacao: `[[idem:v1:${keyHash}:${payloadHash}]]`,
  numeroPedido: "REQ-000010",
};

describe("requisition idempotency", () => {
  const transaction = {
    $queryRaw: vi.fn(),
    requisicao: { findFirst: vi.fn() },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(
      ((callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction)) as never,
    );
    transaction.$queryRaw.mockResolvedValue([]);
    transaction.requisicao.findFirst.mockResolvedValue(existingRequest);
  });

  it("returns the existing requisition for the same key and payload", async () => {
    const result = await criarRequisicaoIdempotente({
      solicitanteId: 4,
      itens: [],
      idempotencyKeyHash: keyHash,
      payloadHash,
    });

    expect(result).toEqual({ requisicao: existingRequest, replayed: true });
    expect(transaction.$queryRaw).toHaveBeenCalled();
    expect(transaction.requisicao.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        solicitanteId: 4,
        observacao: { contains: `[[idem:v1:${keyHash}:` },
      }),
    }));
  });

  it("rejects reusing a key with a different payload", async () => {
    transaction.requisicao.findFirst.mockResolvedValue({
      observacao: `[[idem:v1:${keyHash}:${"c".repeat(64)}]]`,
    });

    await expect(criarRequisicaoIdempotente({
      solicitanteId: 4,
      itens: [],
      idempotencyKeyHash: keyHash,
      payloadHash,
    })).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });
});
