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
  const prioridade = list.filter((l) => l.prioridade === "prioridade").sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
  const padrao = list.filter((l) => l.prioridade === "padrao").sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
  return [...prioridade, ...padrao]
}
