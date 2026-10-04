import {
  ErroMovimentacao,
  type EstadoContaEstoque,
  type LinhaMovimentoConta,
  type OrigemMovimento,
  type ResultadoMovimentacao,
  type TipoMovimentoConta,
} from "./types";
import { validarEstado, validarQuantidade, validarSoma } from "./validacao";

export interface ContextoMovimento {
  itemId: string;
  requisicaoId: string;
  origem: OrigemMovimento;
  correlationId: string;
}

function validarContexto(contexto: ContextoMovimento): void {
  if (
    !contexto.itemId.trim() ||
    !contexto.requisicaoId.trim() ||
    !contexto.correlationId.trim() ||
    !["QR", "DIGITACAO", "SISTEMA"].includes(contexto.origem)
  ) {
    throw new ErroMovimentacao(
      "ESTADO_INVALIDO",
      "Contexto da movimentação inválido.",
    );
  }
}

function criarLinha(
  tipo: TipoMovimentoConta,
  quantidade: number,
  antes: EstadoContaEstoque,
  depois: EstadoContaEstoque,
  contexto: ContextoMovimento,
  motivo: string | null,
): LinhaMovimentoConta {
  return {
    tipo,
    itemId: contexto.itemId,
    requisicaoId: contexto.requisicaoId,
    quantidade,
    fisicoAntes: antes.fisico,
    fisicoDepois: depois.fisico,
    aSepararAntes: antes.aSeparar,
    aSepararDepois: depois.aSeparar,
    emPosseAntes: antes.emPosse,
    emPosseDepois: depois.emPosse,
    origem: contexto.origem,
    motivo,
    correlationId: contexto.correlationId,
    idempotencyKey: `${tipo}:${contexto.requisicaoId}:${contexto.itemId}`,
  };
}

function copiarEstado(estado: EstadoContaEstoque): EstadoContaEstoque {
  return {
    fisico: estado.fisico,
    aSeparar: estado.aSeparar,
    emPosse: estado.emPosse,
    aSepararPorRequisicao: { ...estado.aSepararPorRequisicao },
  };
}

export function debitarRequisicao(
  estado: EstadoContaEstoque,
  pedido: number,
  contexto: ContextoMovimento,
): ResultadoMovimentacao {
  validarEstado(estado);
  validarContexto(contexto);
  validarQuantidade(pedido, "Pedido", false);

  if (pedido > estado.fisico) {
    throw new ErroMovimentacao(
      "SALDO_INSUFICIENTE",
      `Saldo livre insuficiente: agora há ${estado.fisico}.`,
      estado.fisico,
    );
  }

  const depois: EstadoContaEstoque = {
    fisico: estado.fisico - pedido,
    aSeparar: validarSoma(estado.aSeparar + pedido, "A separar"),
    emPosse: estado.emPosse,
    aSepararPorRequisicao: {
      ...estado.aSepararPorRequisicao,
      [contexto.requisicaoId]: validarSoma(
        (estado.aSepararPorRequisicao[contexto.requisicaoId] ?? 0) + pedido,
        "Alocação da requisição",
      ),
    },
  };

  return {
    estado: depois,
    linhas: [
      criarLinha(
        "REQUISICAO_DEBITO",
        pedido,
        estado,
        depois,
        contexto,
        null,
      ),
    ],
  };
}

export function confirmarSeparacao(
  estado: EstadoContaEstoque,
  quantidadeReal: number,
  contexto: ContextoMovimento & { motivo?: string | null },
): ResultadoMovimentacao {
  validarEstado(estado);
  validarContexto(contexto);
  validarQuantidade(quantidadeReal, "Quantidade real");

  const pedido = estado.aSepararPorRequisicao[contexto.requisicaoId] ?? 0;
  if (pedido === 0) {
    throw new ErroMovimentacao(
      "ALOCACAO_INSUFICIENTE",
      "Não há quantidade A separar para esta requisição.",
    );
  }
  if (quantidadeReal > pedido) {
    throw new ErroMovimentacao(
      "QUANTIDADE_ACIMA_DO_PEDIDO",
      `Quantidade real (${quantidadeReal}) excede o pedido (${pedido}).`,
    );
  }

  const devolucao = pedido - quantidadeReal;
  const motivo = contexto.motivo?.trim() || null;
  if (devolucao > 0 && !motivo) {
    throw new ErroMovimentacao(
      "MOTIVO_OBRIGATORIO",
      "Informe o motivo da diferença devolvida ao estoque.",
    );
  }

  const semAlocacao: EstadoContaEstoque = {
    fisico: validarSoma(estado.fisico + devolucao, "Físico"),
    aSeparar: estado.aSeparar - pedido,
    emPosse: estado.emPosse,
    aSepararPorRequisicao: {
      ...estado.aSepararPorRequisicao,
      [contexto.requisicaoId]: 0,
    },
  };

  const linhas = [
    criarLinha(
      "SEPARACAO_CONFIRMADA",
      pedido,
      estado,
      semAlocacao,
      contexto,
      motivo,
    ),
  ];

  let final = semAlocacao;
  if (quantidadeReal > 0) {
    final = {
      ...semAlocacao,
      emPosse: validarSoma(
        semAlocacao.emPosse + quantidadeReal,
        "Em posse",
      ),
    };
    linhas.push(
      criarLinha(
        "ENTREGA",
        quantidadeReal,
        semAlocacao,
        final,
        contexto,
        null,
      ),
    );
  }

  return { estado: final, linhas };
}

export function cancelarRequisicao(
  estado: EstadoContaEstoque,
  contexto: ContextoMovimento,
): ResultadoMovimentacao {
  validarEstado(estado);
  validarContexto(contexto);

  const quantidade = estado.aSepararPorRequisicao[contexto.requisicaoId] ?? 0;
  if (quantidade === 0) {
    return { estado: copiarEstado(estado), linhas: [] };
  }

  const depois: EstadoContaEstoque = {
    fisico: validarSoma(estado.fisico + quantidade, "Físico"),
    aSeparar: estado.aSeparar - quantidade,
    emPosse: estado.emPosse,
    aSepararPorRequisicao: {
      ...estado.aSepararPorRequisicao,
      [contexto.requisicaoId]: 0,
    },
  };

  return {
    estado: depois,
    linhas: [
      criarLinha(
        "CANCELAMENTO_DEVOLUCAO",
        quantidade,
        estado,
        depois,
        contexto,
        null,
      ),
    ],
  };
}
