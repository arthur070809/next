export type ItemChecklist = {
  id: string
  nome: string
  quantidade: number
  unidadeMedida: string
  setor?: "setor1" | "setor2" | "setor3"
}

export type RequisicaoMock = {
  numeroPedido: string
  almoxarifado: "central" | "embalagens" | "materia-prima" | "importados"
  setor: "setor1" | "setor2" | "setor3"
  item: string
  quantidade: number
  unidadeMedida: "un" | "dz" | "ct"
  descricao: string
  data: string // ISO
  codigoTratamento: string
  prioridade: "padrao" | "prioridade"
  status: "pendente" | "em_separacao" | "pronto" | "retirado" | "assumida" | "concluida" | "anulado"
  anuladoPorCracha?: string
  anuladoAt?: string
  assumidaPorCracha?: string
  assumidaAt?: string
  solicitante?: string
  itens?: ItemChecklist[]
}

export type EventoHistorico = {
  id: string
  requisicaoId: string
  numeroPedido: string
  evento: "assumida" | "devolvida" | "finalizada" | "cancelada"
  codigoCracha: string
  descricaoMotivo: string | null
  timestamp: string
  itensFinalizados?: Array<{ nome: string; quantidadePedida: number; quantidadeSeparada: number; separado: boolean; motivo?: string }>
}
