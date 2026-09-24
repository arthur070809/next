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
  status: "pendente" | "em_separacao" | "pronto" | "retirado" | "anulado"
  anuladoPorCracha?: string
  anuladoAt?: string
}
