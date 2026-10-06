import { describe, expect, it, vi } from "vitest";
import {
  demoCatalog,
  demoSeedRequests,
  deterministicDemoId,
  getDemoSeedRequestObservation,
  resetAndSeedDemoData,
  seedDemoData,
  upsertSeedRequest,
} from "./demo-seed";
import { StatusRequisicao } from "@/generated/prisma/client";
import { decodeItemDescription, encodeItemDescription, stripIdempotencyMetadata } from "./requisition-metadata";
import type { Prisma } from "@/generated/prisma/client";

vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn(async () => "demo-seed-test-hash") },
}));

describe("demo data fixture", () => {
  it("contains only the ten requested labels and codes", () => {
    expect(demoCatalog.map(({ codigo, nome }) => [codigo, nome])).toEqual([
      ["129", "RODIZIO GLE 414 NPN-MM (4\" GIRAT.)"],
      ["128", "RODIZIO FLE 312 NPP (3\" FIXA) - MM"],
      ["127", "RODIZIO GLE 312 NPP (3\" GIRAT.) - MM"],
      ["173", "GARFO GGMS 3508 R (GARFO GIRATORIO)"],
      ["7988", "GARFO GGMX 62 (PLATAFORMA ELEVADOR)"],
      ["17940", "GUIA DE FERRO FUNDIDO N° 06"],
      ["1794", "PNEU MACICO 8\""],
      ["1796", "PNEU MACICO 10\""],
      ["1795", "PNEU MACICO 9\""],
      ["5746", "RODA BORRACHA 9200 BIN 3/4 (9\")"],
    ]);
  });

  it("uses multiple stock locations, three near-reorder balances, and no implied lot minimum", () => {
    expect(demoCatalog.every((item) => item.central >= 0 && item.importados >= 0)).toBe(true);
    expect(demoCatalog.filter((item) =>
      item.central + item.importados >= item.pontoPedido &&
      item.central + item.importados <= item.pontoPedido + 1,
    ).map(({ codigo }) => codigo)).toEqual(["7988", "17940", "5746"]);
  });

  it("includes open work and completed history only within the prior 30 days", () => {
    const completed = demoSeedRequests.filter(({ status }) => status === StatusRequisicao.CONCLUIDA);
    expect(completed.map(({ daysAgo }) => daysAgo)).toEqual([24, 11, 3]);
    expect(demoSeedRequests.some(({ status, prioridade }) =>
      status === StatusRequisicao.PENDENTE && prioridade === "PRIORITARIO",
    )).toBe(true);
    expect(demoSeedRequests.some(({ status }) => status === StatusRequisicao.ASSUMIDA)).toBe(true);
    expect(demoSeedRequests.filter(({ status }) => status === StatusRequisicao.PENDENTE)).toHaveLength(2);
  });

  it("stores sector and idempotency metadata using the public metadata helpers", () => {
    for (const request of demoSeedRequests) {
      for (const item of request.items) {
        const publicItemDescription = decodeItemDescription(encodeItemDescription(undefined, item.setor));
        expect(publicItemDescription.setor).toBe(item.setor);
        expect(publicItemDescription.descricao).toBe("");
      }
      const observation = getDemoSeedRequestObservation(request.numeroPedido);
      expect(observation).toContain("[[idem:v1:");
      expect(stripIdempotencyMetadata(observation)).toBe(request.observation ?? null);
    }
  });

  it("uses upsert return records directly and repeats with the same unique keys", async () => {
    const tx = {
      requisicao: {
        upsert: vi.fn(async ({ create }: { create: { id: string }; where: unknown }) => ({ id: create.id })),
      },
      requisicaoItem: {
        upsert: vi.fn(async ({ create }: { create: { id: string }; where: unknown }) => ({ id: create.id })),
      },
    };
    const request = demoSeedRequests[0];
    const employees = new Map([["1111", 11], ["2222", 22]]);
    const items = new Map(request.items.map(({ codigo }) => [codigo, { id: `item-${codigo}`, unit: "unidades" }]));

    const first = await upsertSeedRequest(
      tx as never as Prisma.TransactionClient,
      request,
      employees,
      items,
      "central-id",
    );
    const second = await upsertSeedRequest(
      tx as never as Prisma.TransactionClient,
      request,
      employees,
      items,
      "central-id",
    );

    expect(first.requisicaoId).toBe(second.requisicaoId);
    expect(first.items.map(({ requisitionItemId }) => requisitionItemId))
      .toEqual(second.items.map(({ requisitionItemId }) => requisitionItemId));
    expect(tx.requisicao.upsert).toHaveBeenCalledTimes(2);
    expect(tx.requisicao.upsert.mock.calls[0][0].where)
      .toEqual(tx.requisicao.upsert.mock.calls[1][0].where);
    const itemCallsPerSeed = request.items.length;
    for (let index = 0; index < itemCallsPerSeed; index += 1) {
      expect(tx.requisicaoItem.upsert.mock.calls[index][0].where)
        .toEqual(tx.requisicaoItem.upsert.mock.calls[index + itemCallsPerSeed][0].where);
    }
  });

  it("rejects a parent upsert result without an id before writing child rows", async () => {
    const tx = {
      requisicao: { upsert: vi.fn(async () => ({ id: undefined })) },
      requisicaoItem: { upsert: vi.fn() },
    };
    const request = demoSeedRequests[0];
    const employees = new Map([["1111", 11], ["2222", 22]]);
    const items = new Map(request.items.map(({ codigo }) => [codigo, { id: `item-${codigo}`, unit: "unidades" }]));

    await expect(upsertSeedRequest(
      tx as never as Prisma.TransactionClient,
      request,
      employees,
      items,
      "central-id",
    )).rejects.toThrow(/DEMO-000101.*129.*requisicao/i);
    expect(tx.requisicaoItem.upsert).not.toHaveBeenCalled();
  });

  it("does not recreate requests or movements when the seed runs a second time", async () => {
    const employeeIds = new Map([["1111", 11], ["2222", 22], ["3333", 33]]);
    const localIds = new Map([["estoque", "central-id"], ["importados", "imported-id"]]);
    const itemIds = new Map<string, string>(demoCatalog.map(({ codigo }) => [codigo, `item-${codigo}`]));
    const saldoIds = new Map<string, string>();
    for (const fixture of demoCatalog) {
      saldoIds.set(`${itemIds.get(fixture.codigo)}:central-id`, `saldo-central-${fixture.codigo}`);
      saldoIds.set(`${itemIds.get(fixture.codigo)}:imported-id`, `saldo-imported-${fixture.codigo}`);
    }
    let fixtureRequestExists = false;
    const tx = {
      requisicao: {
        findUnique: vi.fn(async () => fixtureRequestExists
          ? { id: deterministicDemoId("request:DEMO-000101") }
          : null),
        count: vi.fn(async () => 0),
        upsert: vi.fn(async ({ create }: { create: { id: string } }) => {
          fixtureRequestExists = true;
          return { id: create.id };
        }),
      },
      movimentacao: {
        count: vi.fn(async () => 0),
        upsert: vi.fn(async ({ create }: { create: { id: string } }) => ({ id: create.id })),
      },
      funcionario: {
        findMany: vi.fn(async () => []),
        upsert: vi.fn(async ({ where }: { where: { cracha: string } }) => ({
          id: employeeIds.get(where.cracha)!,
        })),
      },
      localEstoque: {
        upsert: vi.fn(async ({ where }: { where: { slug: string } }) => ({
          id: localIds.get(where.slug)!,
          slug: where.slug,
        })),
      },
      item: {
        upsert: vi.fn(async ({ where }: { where: { filial_codigo: { codigo: string } } }) => ({
          id: itemIds.get(where.filial_codigo.codigo)!,
          unidade: "unidades",
        })),
      },
      saldoEstoque: {
        upsert: vi.fn(async ({ where }: { where: { itemId_localId: { itemId: string; localId: string } } }) => ({
          id: saldoIds.get(`${where.itemId_localId.itemId}:${where.itemId_localId.localId}`)!,
        })),
        update: vi.fn(async () => ({})),
      },
      requisicaoItem: {
        upsert: vi.fn(async ({ create }: { create: { id: string } }) => ({ id: create.id })),
      },
    };
    const client = {
      $transaction: vi.fn(async (
        callback: (transaction: unknown) => Promise<unknown>,
        _options?: { maxWait?: number; timeout?: number },
      ) => callback(tx)),
    };

    const first = await seedDemoData(client as never);
    const requestCountAfterFirstRun = tx.requisicao.upsert.mock.calls.length;
    const movementCountAfterFirstRun = tx.movimentacao.upsert.mock.calls.length;
    const transactionCountAfterFirstRun = client.$transaction.mock.calls.length;
    const second = await seedDemoData(client as never);

    expect(first).toMatchObject({ initialized: true, preservedExistingDemo: false });
    expect(second).toMatchObject({ initialized: false, preservedExistingDemo: true });
    expect(requestCountAfterFirstRun).toBe(demoSeedRequests.length);
    expect(transactionCountAfterFirstRun).toBeGreaterThanOrEqual(demoSeedRequests.length);
    expect(client.$transaction.mock.calls.every(([, options]) =>
      options?.maxWait === 20_000 && options.timeout === 60_000,
    )).toBe(true);
    expect(tx.requisicao.upsert).toHaveBeenCalledTimes(requestCountAfterFirstRun);
    expect(movementCountAfterFirstRun).toBeGreaterThan(0);
    expect(tx.movimentacao.upsert).toHaveBeenCalledTimes(movementCountAfterFirstRun);
  });

  it("deletes children before request parents with an explicit reset timeout", async () => {
    const operations: string[] = [];
    const sentinel = new Error("stop after reset ordering check");
    const tx = {
      movimentacao: {
        deleteMany: vi.fn(async () => { operations.push("movimentacao"); }),
        count: vi.fn(async () => 0),
      },
      requisicaoItem: {
        deleteMany: vi.fn(async () => { operations.push("requisicaoItem"); }),
      },
      auditoria: {
        deleteMany: vi.fn(async () => { operations.push("auditoria"); }),
      },
      requisicao: {
        deleteMany: vi.fn(async () => { operations.push("requisicao"); }),
        findUnique: vi.fn(async () => null),
        count: vi.fn(async () => 0),
      },
      saldoEstoque: {
        updateMany: vi.fn(async () => { operations.push("saldoEstoque"); }),
      },
      loginAttemptBucket: {
        deleteMany: vi.fn(async () => { operations.push("loginAttemptBucket"); }),
      },
      funcionario: {
        findMany: vi.fn(async () => { throw sentinel; }),
      },
    };
    const client = {
      $transaction: vi.fn(async (
        callback: (transaction: unknown) => Promise<unknown>,
        options?: { maxWait?: number; timeout?: number },
      ) => {
        expect(options).toMatchObject({ maxWait: 20_000, timeout: 60_000 });
        return callback(tx);
      }),
    };

    await expect(resetAndSeedDemoData(client as never)).rejects.toBe(sentinel);
    expect(operations.indexOf("movimentacao")).toBeLessThan(operations.indexOf("requisicaoItem"));
    expect(operations.indexOf("requisicaoItem")).toBeLessThan(operations.indexOf("requisicao"));
    expect(operations.indexOf("auditoria")).toBeLessThan(operations.indexOf("requisicao"));
  });
});
