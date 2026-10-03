import { NextResponse } from "next/server";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { isSameOrigin } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import {
  getRequisition,
  liberarReserva,
  separarItem,
  naoSepararItem,
} from "@/lib/requisicoes-db";
import {
  PapelFuncionario,
  StatusRequisicao,
  StatusItemRequisicao,
} from "@/generated/prisma/client";

type CompletionItem = { id: string; separado: boolean; motivo?: string };
type ActionBody = {
  action?: string;
  codigoCracha?: string;
  descricaoMotivo?: string;
  itens?: CompletionItem[];
};
type RouteContext = { params: Promise<{ numeroPedido: string }> };

const badRequest = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const funcionario = await getAuthenticatedFuncionario();
    if (!funcionario) return badRequest("Não autenticado.", 401);

    const { numeroPedido: rawNumero } = await params;
    if (!rawNumero) return badRequest("Número da requisição inválido.");

    const numeroPedido = decodeURIComponent(rawNumero);
    const requisicao = await getRequisition(numeroPedido);
    if (!requisicao) return badRequest("Requisição não encontrada.", 404);

    return NextResponse.json({ requisicao });
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
    const badge = body.codigoCracha?.trim();

    if (!badge) return badRequest("Informe o código do crachá.");
    if (!["assumir", "devolver", "anular", "finalizar"].includes(action ?? "")) {
      return badRequest("Ação inválida.");
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
        action === "assumir"
          ? requisicao.status === StatusRequisicao.PENDENTE
          : action === "devolver" || action === "finalizar"
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
      let event: "assumida" | "devolvida" | "finalizada" | "cancelada";

      if (action === "assumir") {
        await tx.requisicao.update({
          where: { id: requisicao.id },
          data: {
            status: StatusRequisicao.ASSUMIDA,
            atendenteId: actor.id,
            assumidaEm: new Date(),
          },
        });

        await tx.requisicaoItem.updateMany({
          where: { requisicaoId: requisicao.id, status: StatusItemRequisicao.PENDENTE },
          data: { status: StatusItemRequisicao.ASSUMIDO },
        });

        await tx.auditoria.create({
          data: {
            acao: "REQUISICAO_ASSUMIDA",
            alvoId: actor.id,
            autorId: actor.id,
            detalhes: `Requisição ${numeroPedido} assumida`,
          },
        });

        event = "assumida";
      } else if (action === "devolver") {
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
