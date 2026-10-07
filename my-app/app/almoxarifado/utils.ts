import type { RequisicaoMock } from "../../lib/types/almoxarifado"

export function aplicarFiltros(list: RequisicaoMock[], filters: { almoxarifado?: string; item?: string; date?: string }) {
  return list.filter((r) => {
    if (filters.almoxarifado && r.almoxarifado !== filters.almoxarifado) return false
    if (filters.item && !r.item.toLowerCase().includes(filters.item.toLowerCase())) return false
    if (filters.date) {
      const d = new Date(filters.date)
      const rDate = new Date(r.data)
      if (rDate.getFullYear() !== d.getFullYear() || rDate.getMonth() !== d.getMonth() || rDate.getDate() !== d.getDate()) return false
    }
    return true
  })
}

export function sortRequisitionsByPriority(list: RequisicaoMock[]) {
  return [...list].sort((left, right) => {
    const priorityOrder = Number(right.prioridade === "prioridade") - Number(left.prioridade === "prioridade");
    if (priorityOrder !== 0) return priorityOrder;

    const leftCreated = Date.parse(left.data);
    const rightCreated = Date.parse(right.data);
    if (Number.isFinite(leftCreated) && Number.isFinite(rightCreated) && leftCreated !== rightCreated) {
      return leftCreated - rightCreated;
    }

    const leftId = left.id ?? left.numeroPedido;
    const rightId = right.id ?? right.numeroPedido;
    return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
  });
}

export const ordenarRequisicoes = sortRequisitionsByPriority;
