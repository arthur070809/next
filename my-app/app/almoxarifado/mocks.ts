import type { RequisicaoMock } from "../../lib/types/almoxarifado"

// Deterministic mock data to avoid SSR/client hydration mismatch
const itens = Array.from({ length: 20 }, (_, i) => `Item ${i + 1}`)
const almoxarifados = ["central", "embalagens", "materia-prima", "importados"] as const
const setores = ["setor1", "setor2", "setor3"] as const
const unidades = ["un", "dz", "ct"] as const
const statuses = ["pendente", "em_separacao", "pronto", "retirado"] as const

function deterministicDate(i: number) {
  const d = new Date()
  // spread dates across the last 30 days deterministically
  d.setDate(d.getDate() - (i % 30))
  d.setHours((i * 7) % 24, (i * 13) % 60, 0, 0)
  return d.toISOString()
}

export const REQUISICOES_MOCK: RequisicaoMock[] = Array.from({ length: 20 }).map((_, i) => ({
  numeroPedido: `#${String(i + 1).padStart(4, "0")}`,
  almoxarifado: almoxarifados[i % almoxarifados.length],
  setor: setores[i % setores.length],
  item: itens[i % itens.length],
  quantidade: (i * 3) % 20 + 1,
  unidadeMedida: unidades[i % unidades.length],
  descricao: `Necessidade de reposição para ${itens[i % itens.length]}`,
  data: deterministicDate(i),
  codigoTratamento: "209",
  prioridade: i % 7 === 0 ? "prioridade" : "padrao",
  status: statuses[i % statuses.length],
}))
