export default function DepositoEmptyState({
  filtered,
  onAdd,
}: {
  filtered: boolean;
  onAdd: () => void;
}) {
  return <div role="status" className="my-6 rounded-lg border border-dashed border-border bg-white px-5 py-8 text-center">
    <p className="font-semibold text-foreground">
      {filtered ? "Nenhum item encontrado com este filtro." : "Nenhuma sobra registrada no depósito."}
    </p>
    <p className="mt-1 text-sm text-text-secondary">
      Pesquise qualquer item do estoque ou registre uma sobra para iniciar o saldo.
    </p>
    <button
      type="button"
      onClick={onAdd}
      className="mt-4 min-h-11 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover"
    >
      Adicionar sobra
    </button>
  </div>;
}
