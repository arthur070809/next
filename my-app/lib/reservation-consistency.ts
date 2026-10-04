export type ReservationKey = { itemId: string; localId: string };

export type StoredReservation = ReservationKey & {
  fisico: number;
  reservado: number;
  codigo: string | null;
  nome: string;
  local: string;
};

export type ExpectedReservation = ReservationKey & { quantidade: number };

export type ReservationMismatch = {
  itemId: string;
  localId: string;
  codigo: string | null;
  nome: string;
  local: string;
  fisico: number;
  reservado: number;
  esperado: number;
};

function keyOf(value: ReservationKey) {
  return `${value.itemId}\u0000${value.localId}`;
}

export function encontrarDivergenciasReserva(
  saldoGuardado: StoredReservation[],
  requisicoesAbertas: ExpectedReservation[],
): ReservationMismatch[] {
  const expectedByKey = new Map<string, number>();
  const expectedIdentityByKey = new Map<string, ReservationKey>();
  for (const item of requisicoesAbertas) {
    const key = keyOf(item);
    expectedByKey.set(key, (expectedByKey.get(key) ?? 0) + item.quantidade);
    expectedIdentityByKey.set(key, { itemId: item.itemId, localId: item.localId });
  }

  const storedByKey = new Map(saldoGuardado.map((balance) => [keyOf(balance), balance]));
  const keys = new Set([...storedByKey.keys(), ...expectedByKey.keys()]);
  const mismatches: ReservationMismatch[] = [];

  for (const key of keys) {
    const stored = storedByKey.get(key);
    const identity = stored ?? expectedIdentityByKey.get(key);
    const esperado = expectedByKey.get(key) ?? 0;
    const reservado = stored?.reservado ?? 0;
    if (reservado === esperado) continue;
    mismatches.push({
      itemId: identity?.itemId ?? "",
      localId: identity?.localId ?? "",
      codigo: stored?.codigo ?? null,
      nome: stored?.nome ?? "Saldo não encontrado",
      local: stored?.local ?? "Local não encontrado",
      fisico: stored?.fisico ?? 0,
      reservado,
      esperado,
    });
  }

  return mismatches;
}
