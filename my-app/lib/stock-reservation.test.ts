import { describe, expect, it } from "vitest";
import { reservarSaldoAtomicamente } from "./stock-reservation";

describe("reservarSaldoAtomicamente", () => {
  it("aceita uma reserva se a atualização condicional altera uma linha", async () => {
    await expect(reservarSaldoAtomicamente({
      itemId: "item-1",
      quantidade: 2,
      atualizarSaldo: async () => 1,
      lerSaldo: async () => null,
    })).resolves.toBeUndefined();
  });

  it("rejeita saldo insuficiente com o saldo livre atualizado", async () => {
    await expect(reservarSaldoAtomicamente({
      itemId: "item-1",
      quantidade: 4,
      atualizarSaldo: async () => 0,
      lerSaldo: async () => ({ fisico: 8, reservado: 6, nome: "Arruela" }),
    })).rejects.toMatchObject({
      code: "SALDO_INSUFICIENTE",
      itemId: "item-1",
      disponivel: 2,
      message: 'Saldo livre mudou: agora há 2 para "Arruela".',
    });
  });

  it("serializa concorrência no último saldo através do update condicional", async () => {
    let reservado = 0;
    const atualizar = async () => {
      await Promise.resolve();
      if (1 - reservado < 1) return 0;
      reservado += 1;
      return 1;
    };
    const attempt = () => reservarSaldoAtomicamente({
      itemId: "item-1",
      quantidade: 1,
      atualizarSaldo: atualizar,
      lerSaldo: async () => ({ fisico: 1, reservado }),
    });

    const results = await Promise.allSettled([attempt(), attempt()]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(reservado).toBe(1);
  });

  it("rejeita uma quantidade inválida sem atualizar o saldo", async () => {
    let updates = 0;
    await expect(reservarSaldoAtomicamente({
      itemId: "item-1",
      quantidade: 0,
      atualizarSaldo: async () => { updates += 1; return 1; },
      lerSaldo: async () => null,
    })).rejects.toThrow("inteiro positivo");
    expect(updates).toBe(0);
  });
});
