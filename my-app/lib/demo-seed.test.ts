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
        createMany: vi.fn(async ({ data }: { data: Array<{ id: string }> }) => ({ count: data.length })),
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
    const expectedItemIds = request.items.map(({ codigo }) =>
      deterministicDemoId(`request-item:${request.numeroPedido}:${codigo}`),
    );
    expect(tx.requisicaoItem.createMany).toHaveBeenCalledTimes(2);
    expect(tx.requisicaoItem.createMany.mock.calls[0][0].data.map(({ id }) => id))
      .toEqual(expectedItemIds);
    expect(tx.requisicaoItem.createMany.mock.calls[1][0].data.map(({ id }) => id))
      .toEqual(expectedItemIds);
  });

  it("rejects a parent upsert result without an id before writing child rows", async () => {
    const tx = {
      requisicao: { upsert: vi.fn(async () => ({ id: undefined })) },
      requisicaoItem: { createMany: vi.fn() },
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
    )).rejects.toThrow(/DEMO-000101.*129.*requisição/i);
    expect(tx.requisicaoItem.createMany).not.toHaveBeenCalled();
  });

  it("does not duplicate requests or movements when the seed runs a second time", async () => {
    const employeeIds = new Map([["1111", 11], ["2222", 22], ["3333", 33]]);
    const localIds = new Map([["estoque", "central-id"], ["importados", "imported-id"]]);
    const itemIds = new Map<string, string>(demoCatalog.map(({ codigo }) => [codigo, `item-${codigo}`]));
    const requests = new Map<string, Record<string, unknown>>();
    const items = new Map<string, Record<string, unknown>>();
    const movements = new Map<string, Record<string, unknown>>();
    const audits = new Map<string, Record<string, unknown>>();
    const stocks = new Map<string, Record<string, unknown>>();
    const keyForStock = (itemId: string, localId: string) => `${itemId}:${localId}`;
    const tx = {
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
        upsert: vi.fn(async ({ where, create, update }: {
          where: { itemId_localId: { itemId: string; localId: string } };
          create: Record<string, unknown>;
          update: Record<string, unknown>;
        }) => {
          const key = keyForStock(where.itemId_localId.itemId, where.itemId_localId.localId);
          const current = stocks.get(key) ?? {
            id: `saldo-${key}`,
            itemId: where.itemId_localId.itemId,
            localId: where.itemId_localId.localId,
            quantidade: create.quantidade,
            reservada: create.reservada,
          };
          Object.assign(current, update);
          stocks.set(key, current);
          return { id: current.id };
        }),
        update: vi.fn(async ({ where, data }: {
          where: { itemId_localId: { itemId: string; localId: string } };
          data: Record<string, unknown>;
        }) => {
          Object.assign(stocks.get(keyForStock(
            where.itemId_localId.itemId,
            where.itemId_localId.localId,
          ))!, data);
          return {};
        }),
      },
      requisicao: {
        upsert: vi.fn(async ({ create }: { create: Record<string, unknown> }) => {
          const number = String(create.numeroPedido);
          const row = requests.get(number) ?? create;
          requests.set(number, row);
          return { id: row.id };
        }),
      },
      requisicaoItem: {
        createMany: vi.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
          for (const row of data) if (!items.has(String(row.id))) items.set(String(row.id), row);
          return { count: data.length };
        }),
      },
      movimentacao: {
        createMany: vi.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
          for (const row of data) if (!movements.has(String(row.id))) movements.set(String(row.id), row);
          return { count: data.length };
        }),
      },
      auditoria: {
        createMany: vi.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
          for (const row of data) if (!audits.has(String(row.id))) audits.set(String(row.id), row);
          return { count: data.length };
        }),
      },
    };
    const transactionOptions: Array<{ maxWait?: number; timeout?: number } | undefined> = [];
    const client = {
      $transaction: vi.fn(async (
        callback: (transaction: unknown) => Promise<unknown>,
        options?: { maxWait?: number; timeout?: number },
      ) => {
        transactionOptions.push(options);
        return callback(tx);
      }),
      requisicao: {
        findMany: vi.fn(async ({ select }: { select: { itens?: unknown } }) => {
          const rows = [...requests.values()];
          if (!select.itens) return rows.map(({ numeroPedido }) => ({ numeroPedido }));
          return rows.map((row) => ({
            numeroPedido: row.numeroPedido,
            status: row.status,
            prioridade: row.prioridade,
            itens: [...items.values()]
              .filter((item) => item.requisicaoId === row.id)
              .map(({ itemId, localId, quantidade }) => ({ itemId, localId, quantidade })),
          }));
        }),
        count: vi.fn(async () => requests.size),
      },
      movimentacao: {
        count: vi.fn(async () => movements.size),
        findMany: vi.fn(async ({ where, select }: {
          where: { id?: { in: string[] }; saldoEstoqueId?: { in: string[] } };
          select: { id?: boolean };
        }) => {
          const rows = [...movements.values()];
          const filtered = where.id
            ? rows.filter(({ id }) => where.id!.in.includes(String(id)))
            : rows.filter(({ saldoEstoqueId }) => where.saldoEstoqueId!.in.includes(String(saldoEstoqueId)));
          if (select.id) return filtered.map(({ id }) => ({ id }));
          return filtered.sort((a, b) =>
            (a.criadoEm as Date).getTime() - (b.criadoEm as Date).getTime() ||
            String(a.id).localeCompare(String(b.id)),
          ).map(({ saldoEstoqueId, tipo, quantidade, saldoApos }) => ({
            saldoEstoqueId, tipo, quantidade, saldoApos,
          }));
        }),
      },
      item: {
        findMany: vi.fn(async () => [...itemIds].map(([codigo, id]) => ({ id, codigo }))),
      },
      localEstoque: {
        findMany: vi.fn(async () => [...localIds].map(([slug, id]) => ({ id, slug }))),
      },
      saldoEstoque: {
        findMany: vi.fn(async () => [...stocks.values()]),
      },
    };

    const first = await seedDemoData(client as never);
    const requestCountAfterFirstRun = requests.size;
    const itemCountAfterFirstRun = items.size;
    const movementCountAfterFirstRun = movements.size;
    const auditCountAfterFirstRun = audits.size;
    const transactionCountAfterFirstRun = client.$transaction.mock.calls.length;
    const second = await seedDemoData(client as never);

    expect(first).toMatchObject({ initialized: true, preservedExistingDemo: false });
    expect(second).toMatchObject({ initialized: false, preservedExistingDemo: true });
    expect(requestCountAfterFirstRun).toBe(demoSeedRequests.length);
    expect(itemCountAfterFirstRun).toBe(demoSeedRequests.reduce((sum, request) => sum + request.items.length, 0));
    expect([...items.values()].every(({ requisicaoId }) =>
      typeof requisicaoId === "string" && requisicaoId.length > 0,
    )).toBe(true);
    expect(movementCountAfterFirstRun).toBeGreaterThan(20);
    expect(auditCountAfterFirstRun).toBe(demoSeedRequests.length);
    expect(transactionCountAfterFirstRun).toBeGreaterThanOrEqual(demoSeedRequests.length);
    expect(transactionOptions.every((options) =>
      options?.maxWait === 20_000 && options.timeout === 60_000,
    )).toBe(true);
    expect(requests.size).toBe(requestCountAfterFirstRun);
    expect(items.size).toBe(itemCountAfterFirstRun);
    expect(movements.size).toBe(movementCountAfterFirstRun);
    expect(audits.size).toBe(auditCountAfterFirstRun);
  });

  it("deletes children before request parents with an explicit reset timeout", async () => {
    const operations: string[] = [];
    const sentinel = new Error("stop after reset ordering check");
    const tx = {
      movimentacao: {
        deleteMany: vi.fn(async () => { operations.push("movimentacao"); }),
      },
      requisicaoItem: {
        deleteMany: vi.fn(async () => { operations.push("requisicaoItem"); }),
      },
      auditoria: {
        deleteMany: vi.fn(async () => { operations.push("auditoria"); }),
      },
      requisicao: {
        deleteMany: vi.fn(async () => { operations.push("requisicao"); }),
      },
      loginAttemptBucket: {
        deleteMany: vi.fn(async () => { operations.push("loginAttemptBucket"); }),
      },
    };
    const client = {
      $transaction: vi.fn(async (
        callback: (transaction: unknown) => Promise<unknown>,
        options?: { maxWait?: number; timeout?: number },
      ) => {
        expect(options).toMatchObject({ maxWait: 20_000, timeout: 60_000 });
        await callback(tx);
        throw sentinel;
      }),
    };

    await expect(resetAndSeedDemoData(client as never)).rejects.toBe(sentinel);
    expect(operations.indexOf("movimentacao")).toBeLessThan(operations.indexOf("requisicaoItem"));
    expect(operations.indexOf("requisicaoItem")).toBeLessThan(operations.indexOf("requisicao"));
  });
});
