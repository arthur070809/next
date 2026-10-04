import { calcularSaldoLivre } from "./stock-availability";

export async function reservarSaldoAtomicamente(params: {
  itemId: string;
  quantidade: number;
  atualizarSaldo: () => Promise<number>;
  lerSaldo: () => Promise<{ fisico: number; reservado: number; nome?: string } | null>;
}) {
  if (!Number.isSafeInteger(params.quantidade) || params.quantidade < 1) {
    throw new Error("A quantidade a reservar deve ser um inteiro positivo.");
  }

  const updatedRows = await params.atualizarSaldo();
  if (updatedRows === 1) return;
  if (updatedRows !== 0) throw new Error("A atualização de reserva afetou um número inesperado de saldos.");

  const current = await params.lerSaldo();
  const disponivel = current
    ? calcularSaldoLivre(current.fisico, current.reservado).livre
    : 0;
  const nome = current?.nome ? ` para "${current.nome}"` : "";
  throw Object.assign(
    new Error(`Saldo livre mudou: agora há ${disponivel}${nome}.`),
    { code: "SALDO_INSUFICIENTE", itemId: params.itemId, disponivel },
  );
}
