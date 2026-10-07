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

export function ordenarRequisicoes(list: RequisicaoMock[]) {
  return list.filter((requisicao) => requisicao.prioridade === "prioridade")
    .concat(list.filter((requisicao) => requisicao.prioridade !== "prioridade"))
}
