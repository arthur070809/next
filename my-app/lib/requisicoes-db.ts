/**
 * Helpers de acesso a dados de requisições — reescrito para Prisma + novo schema.
 * Preserva o formato RequisicaoMock para compatibilidade com o front-end.
 */
import { prisma } from "@/lib/prisma";
import type { RequisicaoMock } from "@/lib/types/almoxarifado";
import {
  PrismaClient,
  Prisma,
  StatusRequisicao,
  StatusItemRequisicao,
  TipoMovimentacao,
} from "@/generated/prisma/client";

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/** Inclui relacionamentos para construir RequisicaoMock */
const REQUISICAO_INCLUDE = {
  solicitante: { select: { nome: true, cracha: true } },
  atendente: { select: { nome: true, cracha: true } },
  itens: {
    include: {
      item: { select: { nome: true } },
      local: { select: { slug: true } },
    },
  },
} satisfies Prisma.RequisicaoInclude;

type RequisicaoWithRelations = Prisma.RequisicaoGetPayload<{
  include: typeof REQUISICAO_INCLUDE;
}>;

/** Converte status do banco para string lowercase usada pelo front */
function statusToFront(status: StatusRequisicao): RequisicaoMock["status"] {
  switch (status) {
    case StatusRequisicao.PENDENTE: return "pendente";
    case StatusRequisicao.ASSUMIDA: return "assumida";
    case StatusRequisicao.CONCLUIDA: return "concluida";
    case StatusRequisicao.ANULADA: return "anulado";
  }
}

/** Monta um RequisicaoMock a partir do modelo Prisma */
export function toRequisicaoMock(req: RequisicaoWithRelations): RequisicaoMock {
  const primeiroItem = req.itens[0];
  const almoxarifadoSlug = primeiroItem?.local?.slug ?? "estoque";
  const almoxarifadoFront = (["central", "embalagens", "materia-prima", "importados"] as const).find(
    (s) => s === almoxarifadoSlug
  ) ?? "central";

  return {
    numeroPedido: req.numeroPedido,
    almoxarifado: almoxarifadoFront,
    setor: "setor1", // setor não está no novo schema — valor padrão para compatibilidade
    item: primeiroItem?.item?.nome ?? "Sem itens",
    quantidade: primeiroItem?.quantidade ?? 0,
    unidadeMedida: (primeiroItem?.unidadeMedida?.toLowerCase() ?? "un") as RequisicaoMock["unidadeMedida"],
    descricao: primeiroItem?.descricao ?? "",
    data: req.criadoEm.toISOString(),
    codigoTratamento: "209",
    prioridade: req.prioridade === "PRIORITARIO" ? "prioridade" : "padrao",
    status: statusToFront(req.status),
    solicitante: req.solicitante?.nome ?? "Solicitante",
    assumidaPorCracha: req.atendente?.cracha ?? undefined,
    assumidaAt: req.assumidaEm?.toISOString() ?? undefined,
    anuladoPorCracha: undefined,
    anuladoAt: req.anuladaEm?.toISOString() ?? undefined,
    itens: req.itens.map((ri) => ({
      id: ri.id,
      nome: ri.item?.nome ?? "Item",
      quantidade: ri.quantidade,
      unidadeMedida: ri.unidadeMedida,
    })),
  };
}

/** Lista requisições abertas (pendente + assumida) */
export async function listOpenRequisitions(): Promise<RequisicaoMock[]> {
  const requisicoes = await prisma.requisicao.findMany({
    where: { status: { in: [StatusRequisicao.PENDENTE, StatusRequisicao.ASSUMIDA] } },
    include: REQUISICAO_INCLUDE,
    orderBy: [{ prioridade: "desc" }, { criadoEm: "asc" }],
    take: 200, // limite razoável para fila de trabalho
  });
  return requisicoes.map(toRequisicaoMock);
}

/** Busca uma requisição pelo numeroPedido */
export async function getRequisition(numeroPedido: string): Promise<RequisicaoMock | null> {
  const req = await prisma.requisicao.findUnique({
    where: { numeroPedido },
    include: REQUISICAO_INCLUDE,
  });
  return req ? toRequisicaoMock(req) : null;
}

/** Gera o próximo número de requisição atomicamente (ex.: REQ-000123) */
export async function nextNumeroPedido(tx: TransactionClient): Promise<string> {
  // UPDATE atomico na tabela de sequência — seguro contra concorrência
  await tx.$executeRaw`UPDATE sequencia_requisicao SET proximo = proximo + 1 WHERE id = 1`;
  const [{ proximo }] = await tx.$queryRaw<[{ proximo: number }]>`
    SELECT proximo FROM sequencia_requisicao WHERE id = 1
  `;
  const numero = proximo - 1; // o valor antes do incremento
  return `REQ-${String(numero).padStart(6, "0")}`;
}

/**
 * Cria uma requisição multi-item com reserva atômica de estoque.
 * Rejeita com HTTP 409 se qualquer item não tiver saldo disponível suficiente.
 * Tudo em uma única transação — nada é criado se algum item falhar.
 */
export async function criarRequisicao(params: {
  solicitanteId: number;
  itens: Array<{
    itemId: string;
    localId: string;
    quantidade: number;
    unidadeMedida?: string;
    descricao?: string;
  }>;
  prioridade?: "padrao" | "prioridade";
  observacao?: string;
  movimentacaoObservacao?: string;
}) {
  return prisma.$transaction(async (tx) => {
    // Valida e reserva cada item atomicamente sem ler-depois-escrever
    for (const itemPayload of params.itens) {
      const updateResult = await tx.$executeRaw`
        UPDATE saldos_estoque
        SET reservada = reservada + ${itemPayload.quantidade}
        WHERE item_id = ${itemPayload.itemId}
          AND local_id = ${itemPayload.localId}
          AND (quantidade - reservada) >= ${itemPayload.quantidade}
      `;

      if (updateResult === 0) {
        // Busca saldo atual para mensagem de erro informativa
        const saldo = await tx.saldoEstoque.findUnique({
          where: { itemId_localId: { itemId: itemPayload.itemId, localId: itemPayload.localId } },
          include: { item: { select: { nome: true } } },
        });
        const disponivel = saldo ? Math.max(0, saldo.quantidade - saldo.reservada) : 0;
        const nomeItem = saldo?.item?.nome ?? itemPayload.itemId;
        throw Object.assign(
          new Error(`Saldo insuficiente para "${nomeItem}": disponível ${disponivel}, solicitado ${itemPayload.quantidade}`),
          { code: "SALDO_INSUFICIENTE", itemId: itemPayload.itemId, disponivel }
        );
      }
    }

    // Gera número de pedido
    const numeroPedido = await nextNumeroPedido(tx);

    // Cria a requisição
    const requisicao = await tx.requisicao.create({
      data: {
        numeroPedido,
        prioridade: params.prioridade === "prioridade" ? "PRIORITARIO" : "PADRAO",
        observacao: params.observacao ?? null,
        solicitanteId: params.solicitanteId,
        itens: {
          create: params.itens.map((ri) => ({
            itemId: ri.itemId,
            localId: ri.localId,
            quantidade: ri.quantidade,
            unidadeMedida: ri.unidadeMedida ?? "UN",
            descricao: ri.descricao ?? null,
            status: StatusItemRequisicao.PENDENTE,
          })),
        },
      },
      include: {
        itens: { include: { item: { select: { nome: true } }, local: { select: { slug: true } } } },
        solicitante: { select: { nome: true, cracha: true } },
        atendente: { select: { nome: true, cracha: true } },
      },
    });

    // Registra movimentações de RESERVA para cada item
    for (const ri of requisicao.itens) {
      const saldo = await tx.saldoEstoque.findUnique({
        where: { itemId_localId: { itemId: ri.itemId, localId: ri.localId } },
      });
      if (saldo) {
        await tx.movimentacao.create({
          data: {
            tipo: TipoMovimentacao.RESERVA,
            quantidade: ri.quantidade,
            saldoApos: saldo.quantidade,
            reservadaApos: saldo.reservada,
            funcionarioId: params.solicitanteId,
            saldoEstoqueId: saldo.id,
            requisicaoId: requisicao.id,
            requisicaoItemId: ri.id,
            observacao: params.movimentacaoObservacao ?? `Reserva para ${requisicao.numeroPedido}`,
          },
        });
      }
    }

    return requisicao;
  });
}

/**
 * Libera a reserva de todos os itens de uma requisição (anulação/cancelamento).
 * Registra movimentação de LIBERACAO_RESERVA.
 */
export async function liberarReserva(params: {
  requisicaoId: string;
  funcionarioId: number;
  tx: TransactionClient;
}) {
  const { requisicaoId, funcionarioId, tx } = params;

  const itens = await tx.requisicaoItem.findMany({
    where: { requisicaoId, status: { in: [StatusItemRequisicao.PENDENTE, StatusItemRequisicao.ASSUMIDO] } },
  });

  for (const item of itens) {
    const updateResult = await tx.$executeRaw`
      UPDATE saldos_estoque
      SET reservada = GREATEST(0, reservada - ${item.quantidade})
      WHERE item_id = ${item.itemId}
        AND local_id = ${item.localId}
    `;
    void updateResult;

    const saldo = await tx.saldoEstoque.findUnique({
      where: { itemId_localId: { itemId: item.itemId, localId: item.localId } },
    });
    if (saldo) {
      await tx.movimentacao.create({
        data: {
          tipo: TipoMovimentacao.LIBERACAO_RESERVA,
          quantidade: item.quantidade,
          saldoApos: saldo.quantidade,
          reservadaApos: saldo.reservada,
          funcionarioId,
          saldoEstoqueId: saldo.id,
          requisicaoId,
          requisicaoItemId: item.id,
          observacao: "Liberação de reserva (anulação/devolução)",
        },
      });
    }

    await tx.requisicaoItem.update({
      where: { id: item.id },
      data: { status: StatusItemRequisicao.ANULADO, resolvidoEm: new Date() },
    });
  }
}

/**
 * Realiza a baixa de estoque ao separar um item (almoxarife).
 * Idempotente: se o item já estiver SEPARADO, não faz nada.
 */
export async function separarItem(params: {
  requisicaoItemId: string;
  funcionarioId: number;
  tx: TransactionClient;
}): Promise<"ok" | "already_done"> {
  const { requisicaoItemId, funcionarioId, tx } = params;

  const ri = await tx.requisicaoItem.findUnique({
    where: { id: requisicaoItemId },
  });
  if (!ri) throw new Error("Item de requisição não encontrado.");

  // Idempotência: já separado ou anulado — não age novamente
  if (ri.status === StatusItemRequisicao.SEPARADO) return "already_done";
  if (ri.status === StatusItemRequisicao.ANULADO || ri.status === StatusItemRequisicao.NAO_SEPARADO) {
    throw new Error("Item já resolvido.");
  }

  // Baixa atômica: desconta da quantidade E da reservada simultaneamente
  const updateResult = await tx.$executeRaw`
    UPDATE saldos_estoque
    SET
      quantidade = quantidade - ${ri.quantidade},
      reservada = GREATEST(0, reservada - ${ri.quantidade})
    WHERE item_id = ${ri.itemId}
      AND local_id = ${ri.localId}
      AND quantidade >= ${ri.quantidade}
      AND reservada >= ${ri.quantidade}
  `;

  if (updateResult === 0) {
    // Pode ser idempotência (outra requisição separou o último item)
    // Verifica se o saldo foi insuficiente
    const saldo = await tx.saldoEstoque.findUnique({
      where: { itemId_localId: { itemId: ri.itemId, localId: ri.localId } },
    });
    if ((saldo?.quantidade ?? 0) < ri.quantidade) {
      throw Object.assign(
        new Error("Saldo insuficiente para separação."),
        { code: "SALDO_INSUFICIENTE" }
      );
    }
    // Outro caso: já foi processado concorrentemente — tratar como idempotente
    return "already_done";
  }

  const saldo = await tx.saldoEstoque.findUnique({
    where: { itemId_localId: { itemId: ri.itemId, localId: ri.localId } },
  });

  if (saldo) {
    await tx.movimentacao.create({
      data: {
        tipo: TipoMovimentacao.SAIDA,
        quantidade: ri.quantidade,
        saldoApos: saldo.quantidade,
        reservadaApos: saldo.reservada,
        funcionarioId,
        saldoEstoqueId: saldo.id,
        requisicaoId: ri.requisicaoId,
        requisicaoItemId: ri.id,
        observacao: "Saída por separação",
      },
    });
  }

  await tx.requisicaoItem.update({
    where: { id: requisicaoItemId },
    data: { status: StatusItemRequisicao.SEPARADO, separado: true, resolvidoEm: new Date() },
  });

  return "ok";
}

/**
 * Marca item como NAO_SEPARADO e libera a reserva.
 */
export async function naoSepararItem(params: {
  requisicaoItemId: string;
  motivo: string;
  funcionarioId: number;
  tx: TransactionClient;
}): Promise<"ok" | "already_done"> {
  const { requisicaoItemId, motivo, funcionarioId, tx } = params;

  const ri = await tx.requisicaoItem.findUnique({ where: { id: requisicaoItemId } });
  if (!ri) throw new Error("Item de requisição não encontrado.");

  if (ri.status === StatusItemRequisicao.NAO_SEPARADO) return "already_done";
  if (ri.status === StatusItemRequisicao.SEPARADO || ri.status === StatusItemRequisicao.ANULADO) {
    throw new Error("Item já resolvido.");
  }

  // Libera reserva
  await tx.$executeRaw`
    UPDATE saldos_estoque
    SET reservada = GREATEST(0, reservada - ${ri.quantidade})
    WHERE item_id = ${ri.itemId}
      AND local_id = ${ri.localId}
  `;

  const saldo = await tx.saldoEstoque.findUnique({
    where: { itemId_localId: { itemId: ri.itemId, localId: ri.localId } },
  });

  if (saldo) {
    await tx.movimentacao.create({
      data: {
        tipo: TipoMovimentacao.LIBERACAO_RESERVA,
        quantidade: ri.quantidade,
        saldoApos: saldo.quantidade,
        reservadaApos: saldo.reservada,
        funcionarioId,
        saldoEstoqueId: saldo.id,
        requisicaoId: ri.requisicaoId,
        requisicaoItemId: ri.id,
        observacao: `Não separado: ${motivo}`,
      },
    });
  }

  await tx.requisicaoItem.update({
    where: { id: requisicaoItemId },
    data: {
      status: StatusItemRequisicao.NAO_SEPARADO,
      separado: false,
      motivoNaoAtendido: motivo,
      resolvidoEm: new Date(),
    },
  });

  return "ok";
}

/**
 * Verifica se todos os itens da requisição estão resolvidos e fecha a requisição.
 */
export async function checarEFecharRequisicao(params: {
  requisicaoId: string;
  tx: TransactionClient;
}) {
  const { requisicaoId, tx } = params;
  const itens = await tx.requisicaoItem.findMany({ where: { requisicaoId } });
  const todosResolvidos = itens.every(
    (i) =>
      i.status === StatusItemRequisicao.SEPARADO ||
      i.status === StatusItemRequisicao.NAO_SEPARADO ||
      i.status === StatusItemRequisicao.ANULADO
  );
  if (todosResolvidos) {
    await tx.requisicao.update({
      where: { id: requisicaoId },
      data: { status: StatusRequisicao.CONCLUIDA, concluidaEm: new Date() },
    });
  }
  return todosResolvidos;
}
