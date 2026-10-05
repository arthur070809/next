import { describe, expect, it } from "vitest";
import { demoCatalog, demoSeedRequests } from "./demo-seed";
import { StatusRequisicao } from "@/generated/prisma/client";

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
});
