export type StockAvailability = {
  fisico: number;
  reservado: number;
  livre: number;
};

export function calcularSaldoLivre(fisico: unknown, reservado: unknown): StockAvailability {
  if (
    typeof fisico !== "number" ||
    typeof reservado !== "number" ||
    !Number.isSafeInteger(fisico) ||
    !Number.isSafeInteger(reservado) ||
    fisico < 0 ||
    reservado < 0
  ) {
    throw new Error("Os saldos físico e reservado devem ser inteiros não negativos.");
  }

  return {
    fisico,
    reservado,
    livre: Math.max(0, fisico - reservado),
  };
}
