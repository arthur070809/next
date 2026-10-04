import { describe, expect, it } from "vitest";
import { calcularSaldoLivre } from "./stock-availability";

describe("calcularSaldoLivre", () => {
  it("retorna todo o saldo livre sem reserva", () => {
    expect(calcularSaldoLivre(10, 0)).toEqual({ fisico: 10, reservado: 0, livre: 10 });
  });

  it("subtrai as reservas do saldo físico", () => {
    expect(calcularSaldoLivre(10, 4)).toEqual({ fisico: 10, reservado: 4, livre: 6 });
  });

  it("nunca retorna saldo livre negativo", () => {
    expect(calcularSaldoLivre(3, 5)).toEqual({ fisico: 3, reservado: 5, livre: 0 });
  });

  it.each([
    [-1, 0],
    [0, -1],
    [1.5, 0],
    [0, 2.5],
    [Number.MAX_SAFE_INTEGER + 1, 0],
    [0, Number.MAX_SAFE_INTEGER + 1],
    ["", 0],
    [0, ""],
  ])("rejeita saldos inválidos (%j, %j)", (fisico, reservado) => {
    expect(() => calcularSaldoLivre(fisico, reservado)).toThrow();
  });
});
