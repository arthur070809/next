export type RequisicaoItemPayload = {
  itemNome: string
  setor: "setor1" | "setor2" | "setor3"
  quantidade: number
  unidadeMedida: "UN" | "DZ" | "CT"
  descricao: string
  prioridade: "padrao" | "prioridade"
}

export type RequisicaoPayload = {
  solicitanteId: number
  itens: RequisicaoItemPayload[]
  createdAt: string // ISO timestamp da requisição
}
