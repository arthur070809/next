export const MAX_QUANTIDADE = 1_000_000_000;

export type OrigemMovimento = "QR" | "DIGITACAO" | "SISTEMA";

export type TipoMovimentoConta =
  | "REQUISICAO_DEBITO"
  | "SEPARACAO_CONFIRMADA"
  | "ENTREGA"
  | "CANCELAMENTO_DEVOLUCAO";

export interface EstadoContaEstoque {
  fisico: number;
  aSeparar: number;
  emPosse: number;
  aSepararPorRequisicao: Readonly<Record<string, number>>;
}

export interface LinhaMovimentoConta {
  tipo: TipoMovimentoConta;
  itemId: string;
  requisicaoId: string;
  quantidade: number;
  fisicoAntes: number;
  fisicoDepois: number;
  aSepararAntes: number;
  aSepararDepois: number;
  emPosseAntes: number;
  emPosseDepois: number;
  origem: OrigemMovimento;
  motivo: string | null;
  correlationId: string;
  idempotencyKey: string;
}

export interface ResultadoMovimentacao {
  estado: EstadoContaEstoque;
  linhas: LinhaMovimentoConta[];
}

export type CodigoErroMovimentacao =
  | "SALDO_INSUFICIENTE"
  | "QUANTIDADE_ACIMA_DO_PEDIDO"
  | "ALOCACAO_INSUFICIENTE"
  | "QUANTIDADE_INVALIDA"
  | "ESTADO_INVALIDO"
  | "LIMITE_EXCEDIDO"
  | "MOTIVO_OBRIGATORIO";

export class ErroMovimentacao extends Error {
  constructor(
    public readonly codigo: CodigoErroMovimentacao,
    message: string,
    public readonly livreAtual?: number,
  ) {
    super(message);
    this.name = "ErroMovimentacao";
  }
}
