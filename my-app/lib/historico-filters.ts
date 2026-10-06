import type { EventoHistorico } from "@/lib/types/almoxarifado";

export type HistoricoFilters = {
  produto?: string;
  funcionarioId?: number;
  desde?: Date;
  ateExclusive?: Date;
  eventos?: EventoHistorico["evento"][];
};

export function filterHistoricoEvents(events: EventoHistorico[], filters: HistoricoFilters) {
  return events.filter((event) => {
    if (filters.funcionarioId !== undefined && event.funcionarioId !== filters.funcionarioId) return false;
    if (filters.desde && new Date(event.timestamp) < filters.desde) return false;
    if (filters.ateExclusive && new Date(event.timestamp) >= filters.ateExclusive) return false;
    if (filters.eventos?.length && !filters.eventos.includes(event.evento)) return false;
    if (filters.produto) {
      const productFilter = filters.produto.toLocaleLowerCase("pt-BR");
      if (!event.produtos.some(({ codigo, nome }) =>
        `${codigo ?? ""} ${nome}`.toLocaleLowerCase("pt-BR").includes(productFilter),
      )) return false;
    }
    return true;
  }).sort((first, second) => Date.parse(second.timestamp) - Date.parse(first.timestamp));
}

export function paginateHistoricoEvents(events: EventoHistorico[], page: number, pageSize = 50) {
  const total = events.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    events: events.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}
