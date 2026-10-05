import { NextResponse } from "next/server";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { isSameOrigin } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import {
  liberarReserva,
  separarItem,
  naoSepararItem,
} from "@/lib/requisicoes-db";
import { localizarItemDaEtiqueta } from "@/lib/qr/localizarItem";
import { normalizarCodigoEtiqueta, parseEtiqueta } from "@/lib/qr/parseEtiqueta";
import { resolveClaimResult } from "@/lib/request-claim";
import {
  PapelFuncionario,
  StatusRequisicao,
  StatusItemRequisicao,
} from "@/generated/prisma/client";

type CompletionItem = { id: string; separado: boolean; motivo?: string };
type ActionBody = {
  action?: string;
  codigoCracha?: string;
  codigoEtiqueta?: string;
  requisicaoItemId?: string;
  origem?: "QR" | "digitacao";
  descricaoMotivo?: string;
  itens?: CompletionItem[];
};
type RouteContext = { params: Promise<{ numeroPedido: string }> };
const scanAuditAction = "REQUISICAO_ITEM_CONFERIDO";

const badRequest = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const funcionario = await getAuthenticatedFuncionario();
    if (!funcionario) return badRequest("Não autenticado.", 401);
    if (
      funcionario.papel !== PapelFuncionario.ADMIN &&
      funcionario.papel !== PapelFuncionario.ALMOXARIFE
    ) return badRequest("Acesso negado.", 403);

    const { numeroPedido: rawNumero } = await params;
    if (!rawNumero) return badRequest("Número da requisição inválido.");

    const numeroPedido = decodeURIComponent(rawNumero);
    const requisicao = await prisma.requisicao.findUnique({
      where: { numeroPedido },
      include: {
        solicitante: { select: { nome: true } },
        atendente: { select: { id: true, nome: true } },
        itens: {
          include: {
            item: { select: { id: true, nome: true, codigo: true, unidade: true } },
          },
        },
      },
    });
    if (!requisicao) return badRequest("Requisição não encontrada.", 404);
    const auditPrefix = `req:${requisicao.id};`;
    const scans = await prisma.auditoria.findMany({
      where: { acao: scanAuditAction, detalhes: { startsWith: auditPrefix } },
      select: { detalhes: true },
    });
    const checkedIds = new Set(
      scans.map(({ detalhes }) => {
        const match = detalhes?.match(/;item:([^;]+);/);
        return match?.[1];
      }).filter((id): id is string => Boolean(id)),
    );

    return NextResponse.json({
      requisicao: {
        numeroPedido: requisicao.numeroPedido,
        status: requisicao.status,
        prioridade: requisicao.prioridade,
        criadoEm: requisicao.criadoEm,
        solicitante: requisicao.solicitante.nome,
        atendente: requisicao.atendente?.nome ?? null,
        itens: requisicao.itens.map((item) => ({
          id: item.id,
          itemId: item.item.id,
          nome: item.item.nome,
          codigo: item.item.codigo,
          unidadeMedida: item.unidadeMedida,
          quantidadeSolicitada: item.quantidade,
          status: item.status,
          conferido: checkedIds.has(item.id) || item.status === StatusItemRequisicao.SEPARADO,
        })),
      },
    });
  } catch (error) {
    console.error("Falha ao consultar requisição:", error instanceof Error ? error.message : "erro");
    return badRequest("Não foi possível consultar a requisição.", 500);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const sessaoFuncionario = await getAuthenticatedFuncionario();
    if (!sessaoFuncionario) return badRequest("Não autenticado.", 401);
    if (!isSameOrigin(request)) return badRequest("Origem inválida.", 403);

    const { numeroPedido: rawNumero } = await params;
    if (!rawNumero) return badRequest("Número da requisição inválido.");
    const numeroPedido = decodeURIComponent(rawNumero);

    const body = (await request.json()) as ActionBody;
    const action = body.action;
    if (!["assumir", "devolver", "anular", "finalizar", "conferir-item"].includes(action ?? "")) {
      return badRequest("Ação inválida.");
    }
    if (
      action !== "conferir-item" &&
      sessaoFuncionario.papel !== PapelFuncionario.ALMOXARIFE &&
      sessaoFuncionario.papel !== PapelFuncionario.ADMIN
    ) {
      return badRequest("Acesso negado.", 403);
    }

    if (action === "conferir-item") {
      return await prisma.$transaction(async (tx) => {
        const actor = await tx.funcionario.findFirst({
          where: {
            id: sessaoFuncionario.id,
            ativo: true,
            papel: { in: [PapelFuncionario.ADMIN, PapelFuncionario.ALMOXARIFE] },
          },
          select: { id: true, papel: true },
        });
        if (!actor) return badRequest("Acesso negado.", 403);

        const parsed = parseEtiqueta(body.codigoEtiqueta ?? "");
        if (!parsed.ok) return badRequest(parsed.motivo, 400);
        const requisicao = await tx.requisicao.findUnique({
          where: { numeroPedido },
          include: { itens: { select: { id: true, itemId: true, status: true } } },
        });
        if (!requisicao) return badRequest("Requisição não encontrada.", 404);
        if (
          requisicao.status !== StatusRequisicao.ASSUMIDA ||
          (actor.papel !== PapelFuncionario.ADMIN && requisicao.atendenteId !== actor.id)
        ) return badRequest("A requisição não está em atendimento por este usuário.", 409);

        const codigoNormalizado = normalizarCodigoEtiqueta(parsed.codigo);
        const codigosPossiveis = Array.from({ length: 50 }, (_, index) =>
          codigoNormalizado.padStart(index + 1, "0"),
        );
        const produtosRaw = await tx.item.findMany({
          where: { ativo: true, codigo: { in: codigosPossiveis } },
          select: { id: true, nome: true, codigo: true },
        });
        const scans = await tx.auditoria.findMany({
          where: {
            acao: scanAuditAction,
            detalhes: { startsWith: `req:${requisicao.id};` },
          },
          select: { detalhes: true },
        });
        const checkedIds = new Set(
          scans.map(({ detalhes }) => {
            const match = detalhes?.match(/;item:([^;]+);/);
            return match?.[1];
          }).filter((id): id is string => Boolean(id)),
        );
        const result = localizarItemDaEtiqueta({
          codigo: parsed.codigo,
          permitido: true,
          requisicaoAtiva: true,
          produtos: produtosRaw.map((product) => ({
            id: product.id,
            nome: product.nome,
            codigo: product.codigo,
          })),
          itens: requisicao.itens.map((item) => ({
            id: item.id,
            itemId: item.itemId,
            conferido: checkedIds.has(item.id),
            disponivel:
              item.status === StatusItemRequisicao.ASSUMIDO ||
              item.status === StatusItemRequisicao.PENDENTE,
          })),
        });

        if (result.tipo === "produto-inexistente") {
          return badRequest(`Código ${parsed.codigo} não encontrado.`, 404);
        }
        if (result.tipo === "fora-da-requisicao") {
          return NextResponse.json({
            error: "Este item não está nesta requisição.",
            produto: { codigo: result.produto.codigo, nome: result.produto.nome },
          }, { status: 409 });
        }
        if (result.tipo === "ja-conferido") {
          return NextResponse.json({
            message: "Este item já foi conferido.",
            itemId: result.item.id,
            conferido: true,
            jaConferido: true,
          }, { status: 200 });
        }
        if (result.tipo === "item-resolvido") {
          return badRequest("Este item já foi resolvido e não pode ser conferido novamente.", 409);
        }
        if (result.tipo !== "encontrado") return badRequest("Não foi possível conferir este item.", 409);
        if (body.requisicaoItemId && body.requisicaoItemId !== result.item.id) {
          return badRequest("O código não corresponde ao item selecionado.", 409);
        }

        const origem = body.origem === "digitacao" ? "digitacao" : "QR";
        await tx.auditoria.create({
          data: {
            acao: scanAuditAction,
            alvoId: actor.id,
            autorId: actor.id,
            detalhes: `req:${requisicao.id};item:${result.item.id};origem:${origem};codigo:${parsed.codigo}`,
          },
        });
        return NextResponse.json({
          message: "Item conferido. Informe a quantidade real.",
          itemId: result.item.id,
          produto: { codigo: result.produto.codigo, nome: result.produto.nome },
          conferido: true,
          jaConferido: false,
        });
      });
    }

    const badge = body.codigoCracha?.trim();

    if (!badge) return badRequest("Informe o código do crachá.");
    if (action === "assumir") {
      const claim = await prisma.$transaction(async (tx) => {
        const actor = await tx.funcionario.findFirst({
          where: { cracha: badge, ativo: true },
          select: { id: true, nome: true, papel: true },
        });
        if (
          !actor ||
          actor.id !== sessaoFuncionario.id ||
          (actor.papel !== PapelFuncionario.ALMOXARIFE &&
            actor.papel !== PapelFuncionario.ADMIN)
        ) {
          return { type: "forbidden" as const };
        }

        const assumidaEm = new Date();
        const result = await tx.requisicao.updateMany({
          where: { numeroPedido, status: StatusRequisicao.PENDENTE },
          data: {
            status: StatusRequisicao.ASSUMIDA,
            atendenteId: actor.id,
            assumidaEm,
          },
        });
        if (result.count !== 1) return { type: "not-claimed" as const };

        await tx.requisicaoItem.updateMany({
          where: { requisicao: { numeroPedido }, status: StatusItemRequisicao.PENDENTE },
          data: { status: StatusItemRequisicao.ASSUMIDO },
        });
        await tx.auditoria.create({
          data: {
            acao: "REQUISICAO_ASSUMIDA",
            alvoId: actor.id,
            autorId: actor.id,
            detalhes: `Requisição ${numeroPedido} assumida em ${assumidaEm.toISOString()}`,
          },
        });
        return { type: "claimed" as const };
      });

      if (claim.type === "forbidden") return badRequest("Crachá inválido para esta sessão.", 403);
      if (claim.type === "claimed") {
        return NextResponse.json({ message: "Requisição assumida.", numeroPedido });
      }

      const latest = await prisma.requisicao.findUnique({
        where: { numeroPedido },
        select: {
          status: true,
          atendente: { select: { nome: true } },
        },
      });
      const resolution = resolveClaimResult(0, latest ? {
        status: latest.status,
        attendantName: latest.atendente?.nome ?? null,
      } : null);
      if (resolution.type === "not-found") return badRequest("Requisição não encontrada.", 404);
      if (resolution.type === "not-available") {
        return badRequest("A requisição não está mais disponível para assumir. Atualize a fila.", 409);
      }
      if (resolution.type !== "already-claimed") {
        return badRequest("Não foi possível assumir a requisição. Atualize a fila e tente novamente.", 409);
      }
      return NextResponse.json({
        error: `Requisição já assumida por ${resolution.attendantName ?? "outro almoxarife"}.`,
        assumidaPor: resolution.attendantName,
      }, { status: 409 });
    }
    if (action === "anular" && !body.descricaoMotivo?.trim()) {
      return badRequest("Informe o motivo da anulação.");
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Busca requisição com lock implícito na transação
      const requisicao = await tx.requisicao.findUnique({
        where: { numeroPedido },
        include: { itens: true },
      });

      if (!requisicao) {
        return badRequest("Requisição não encontrada.", 404);
      }

      // 2. Busca e valida o funcionário pelo crachá
      const actor = await tx.funcionario.findFirst({
        where: { cracha: badge, ativo: true },
      });

      if (
        !actor ||
        (actor.papel !== PapelFuncionario.ALMOXARIFE &&
          actor.papel !== PapelFuncionario.ADMIN)
      ) {
        return badRequest("Crachá não cadastrado como almoxarife ativo.", 403);
      }

      // 3. Valida transições de status
      const allowed =
        action === "devolver" || action === "finalizar"
          ? requisicao.status === StatusRequisicao.ASSUMIDA
          : requisicao.status === StatusRequisicao.PENDENTE ||
            requisicao.status === StatusRequisicao.ASSUMIDA; // anular

      if (!allowed) {
        return badRequest(
          "A requisição já mudou de status. Atualize a fila antes de tentar novamente.",
          409
        );
      }

      // 4. Executa a ação
      let event: "devolvida" | "finalizada" | "cancelada";

      if (action === "devolver") {
        await tx.requisicao.update({
          where: { id: requisicao.id },
          data: {
            status: StatusRequisicao.PENDENTE,
            atendenteId: null,
            assumidaEm: null,
          },
        });

        await tx.requisicaoItem.updateMany({
          where: { requisicaoId: requisicao.id, status: StatusItemRequisicao.ASSUMIDO },
          data: { status: StatusItemRequisicao.PENDENTE },
        });

        await tx.auditoria.create({
          data: {
            acao: "REQUISICAO_DEVOLVIDA",
            alvoId: actor.id,
            autorId: actor.id,
            detalhes: body.descricaoMotivo?.trim() || `Requisição ${numeroPedido} devolvida à fila`,
          },
        });

        event = "devolvida";
      } else if (action === "anular") {
        // Libera reservas de todos os itens da requisição e registra movimentações
        await liberarReserva({
          requisicaoId: requisicao.id,
          funcionarioId: actor.id,
          tx,
        });

        await tx.requisicao.update({
          where: { id: requisicao.id },
          data: {
            status: StatusRequisicao.ANULADA,
            anuladaEm: new Date(),
            observacao: body.descricaoMotivo?.trim()
              ? `${requisicao.observacao ? requisicao.observacao + " | " : ""}Motivo anulação: ${body.descricaoMotivo.trim()}`
              : requisicao.observacao,
          },
        });

        await tx.auditoria.create({
          data: {
            acao: "REQUISICAO_ANULADA",
            alvoId: actor.id,
            autorId: actor.id,
            detalhes: body.descricaoMotivo?.trim() || `Requisição ${numeroPedido} anulada`,
          },
        });

        event = "cancelada";
      } else {
        // action === "finalizar"
        const outcomes = body.itens ?? [];
        const dbItems = requisicao.itens;
        const itemIds = new Set(outcomes.map((item) => String(item.id)));

        if (
          outcomes.length !== dbItems.length ||
          dbItems.some((item) => !itemIds.has(String(item.id))) ||
          outcomes.some((item) => !item.separado && !item.motivo?.trim())
        ) {
          return badRequest(
            "Informe se cada item foi separado; os itens não separados precisam de um motivo."
          );
        }

        // Processa cada item com regra atômica de estoque
        for (const itemOutcome of outcomes) {
          if (itemOutcome.separado) {
            // Baixa real do estoque (quantidade -= q, reservada -= q) + movimentação SAIDA
            await separarItem({
              requisicaoItemId: String(itemOutcome.id),
              funcionarioId: actor.id,
              tx,
            });
          } else {
            // Libera reserva (reservada -= q) + movimentação LIBERACAO_RESERVA
            await naoSepararItem({
              requisicaoItemId: String(itemOutcome.id),
              motivo: itemOutcome.motivo!.trim(),
              funcionarioId: actor.id,
              tx,
            });
          }
        }

        await tx.requisicao.update({
          where: { id: requisicao.id },
          data: {
            status: StatusRequisicao.CONCLUIDA,
            concluidaEm: new Date(),
          },
        });

        await tx.auditoria.create({
          data: {
            acao: "REQUISICAO_FINALIZADA",
            alvoId: actor.id,
            autorId: actor.id,
            detalhes: `Requisição ${numeroPedido} finalizada`,
          },
        });

        return NextResponse.json({ message: "Requisição finalizada." });
      }

      return NextResponse.json({ message: "Ação registrada.", evento: event });
    });
  } catch (error) {
    console.error("Falha ao alterar requisição:", error instanceof Error ? error.message : "erro");
    return badRequest("Não foi possível registrar a ação.", 500);
  }
}
