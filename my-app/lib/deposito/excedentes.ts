export type ExcedenteRegistro = {
  itemId: string;
  codigo: string | null;
  produto: string;
  categoria: string;
  setor: string;
  quantidadePedida: number;
  quantidadeSeparada: number;
  quantidadeExcedente: number;
  pedidos: string[];
  estoqueLivre: number;
  saldoDeposito: number;
};

export function filtrarExcedentesPorProduto(registros: readonly ExcedenteRegistro[], filtro: string) {
  const query = filtro.trim().toLocaleLowerCase("pt-BR");
  return registros.filter((registro) =>
    !query || `${registro.produto} ${registro.codigo ?? ""} ${registro.categoria}`
      .toLocaleLowerCase("pt-BR")
      .includes(query),
  );
}

export function totalizarExcedentesPorSetor(registros: readonly ExcedenteRegistro[]) {
  const totals = new Map<string, {
    setor: string;
    quantidadePedida: number;
    quantidadeSeparada: number;
    quantidadeExcedente: number;
  }>();
  for (const registro of registros) {
    const total = totals.get(registro.setor) ?? {
      setor: registro.setor,
      quantidadePedida: 0,
      quantidadeSeparada: 0,
      quantidadeExcedente: 0,
    };
    total.quantidadePedida += registro.quantidadePedida;
    total.quantidadeSeparada += registro.quantidadeSeparada;
    total.quantidadeExcedente += registro.quantidadeExcedente;
    totals.set(registro.setor, total);
  }
  return [...totals.values()];
}
