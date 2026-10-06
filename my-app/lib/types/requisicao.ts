export type RequisicaoItemPayload = {
  itemId: string
  setor: "setor1" | "setor2" | "setor3"
  itemNome?: string
  quantidade: number
  unidadeMedida: string
  descricao: string
  prioridade: "padrao" | "prioridade"
}

export type RequisicaoPayload = {
  itens: RequisicaoItemPayload[]
}

export type RequisicaoAtendida = {
  id: string
  numero: number
  item: string
  quantidade: number
  qtdDevolvida: number
  status: string
  origem: "DEPOSITO" | "ESTOQUE" | null
  setor: string | null
  unidadeMedida: string | null
  prioridade: string | null
  createdAt: string
  funcionario: { nome: string }
  estoqueItem: { codigo: string | null } | null
}
