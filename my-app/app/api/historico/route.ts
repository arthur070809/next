import { NextResponse } from "next/server";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripIdempotencyMetadata } from "@/lib/requisition-metadata";
import type { EventoHistorico } from "@/lib/types/almoxarifado";

export async function GET() {
  const funcionario = await getAuthenticatedFuncionario();
  if (!funcionario) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    // Busca requisições com itens e funcionários para compor eventos de histórico
    const requisicoes = await prisma.requisicao.findMany({
      where: {
        OR: [
          { status: "CONCLUIDA" },
          { status: "ANULADA" },
          { status: "ASSUMIDA" },
          { atendenteId: { not: null } },
        ],
      },
      include: {
        solicitante: { select: { nome: true, cracha: true } },
        atendente: { select: { nome: true, cracha: true } },
        itens: {
          include: {
            item: { select: { nome: true } },
            movimentacoes: {
              where: { tipo: "SAIDA" },
              select: { quantidade: true },
            },
          },
        },
      },
      orderBy: { atualizadoEm: "desc" },
      take: 100,
    });

    // Busca registros de auditoria específicos de requisições
    const auditorias = await prisma.auditoria.findMany({
      where: {
        acao: {
          in: [
            "REQUISICAO_ASSUMIDA",
            "REQUISICAO_DEVOLVIDA",
            "REQUISICAO_ANULADA",
            "REQUISICAO_FINALIZADA",
          ],
        },
      },
      include: {
        autor: { select: { cracha: true, nome: true } },
      },
      orderBy: { criadoEm: "desc" },
      take: 200,
    });

    const eventos: EventoHistorico[] = [];

    // Mapeia eventos a partir das requisições e seus itens
    for (const req of requisicoes) {
      const crachaAtendente = req.atendente?.cracha ?? req.solicitante.cracha;

      if (req.status === "CONCLUIDA" && req.concluidaEm) {
        eventos.push({
          id: `concluida-${req.id}`,
          requisicaoId: req.id,
          numeroPedido: req.numeroPedido,
          evento: "finalizada",
          codigoCracha: crachaAtendente,
          descricaoMotivo: req.itens.map((item) => {
            const separated = item.movimentacoes.reduce((total, movement) => total + movement.quantidade, 0);
            return `${item.item.nome}: pedido ${item.quantidade}, separado ${separated}${item.motivoNaoAtendido ? ` (${item.motivoNaoAtendido})` : ""}`;
          }).join("; "),
          timestamp: req.concluidaEm.toISOString(),
          itensFinalizados: req.itens.map((it) => ({
            nome: it.item.nome,
            quantidadePedida: it.quantidade,
            quantidadeSeparada: it.movimentacoes.reduce((total, movement) => total + movement.quantidade, 0),
            separado: Boolean(it.separado),
            motivo: it.motivoNaoAtendido ?? undefined,
          })),
        });
      }

      if (req.status === "ANULADA" && req.anuladaEm) {
        eventos.push({
          id: `anulada-${req.id}`,
          requisicaoId: req.id,
          numeroPedido: req.numeroPedido,
          evento: "cancelada",
          codigoCracha: crachaAtendente,
          descricaoMotivo: stripIdempotencyMetadata(req.observacao) ?? "Requisição cancelada.",
          timestamp: req.anuladaEm.toISOString(),
        });
      }

      if (req.status === "ASSUMIDA" && req.assumidaEm) {
        eventos.push({
          id: `assumida-${req.id}`,
          requisicaoId: req.id,
          numeroPedido: req.numeroPedido,
          evento: "assumida",
          codigoCracha: crachaAtendente,
          descricaoMotivo: null,
          timestamp: req.assumidaEm.toISOString(),
        });
      }
    }

    // Se temos auditorias de devolução ou outras ações, adiciona também
    for (const aud of auditorias) {
      if (aud.acao === "REQUISICAO_DEVOLVIDA") {
        eventos.push({
          id: aud.id,
          requisicaoId: String(aud.alvoId),
          numeroPedido: aud.detalhes?.split(" ")[1] ?? `REQ-${aud.alvoId}`,
          evento: "devolvida",
          codigoCracha: aud.autor.cracha,
          descricaoMotivo: aud.detalhes,
          timestamp: aud.criadoEm.toISOString(),
        });
      }
    }

    // Ordena do mais recente para o mais antigo
    eventos.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json({ eventos });
  } catch (error) {
    console.error("Falha ao consultar histórico:", error instanceof Error ? error.message : "erro");
    return NextResponse.json(
      { error: "Não foi possível carregar o histórico." },
      { status: 500 }
    );
  }
}
