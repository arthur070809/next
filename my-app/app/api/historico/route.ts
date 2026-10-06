import { NextResponse } from "next/server";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decodeItemDescription, stripIdempotencyMetadata } from "@/lib/requisition-metadata";
import { filterHistoricoEvents, paginateHistoricoEvents } from "@/lib/historico-filters";
import type { EventoHistorico } from "@/lib/types/almoxarifado";
import { PapelFuncionario } from "@/generated/prisma/client";

const pageSize = 50;
const requestLimit = 200;
const auditLimit = 400;
const eventKinds: EventoHistorico["evento"][] = ["assumida", "cancelada", "finalizada", "devolvida"];

function parseDate(value: string | null, endOfDay = false): Date | undefined | null {
  if (value === null || value === "") return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  if (endOfDay) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

export async function GET(request: Request) {
  const funcionario = await getAuthenticatedFuncionario();
  if (!funcionario) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  if (
    funcionario.papel !== PapelFuncionario.ADMIN &&
    funcionario.papel !== PapelFuncionario.ALMOXARIFE
  ) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const product = params.get("produto")?.trim() ?? "";
  const employee = params.get("funcionario") ?? "";
  const startDate = parseDate(params.get("desde"));
  const endDate = parseDate(params.get("ate"), true);
  const pageValue = params.get("pagina") ?? "1";
  const eventValue = params.get("eventos")?.split(",").filter(Boolean) ?? [];
  const employeeId = employee ? Number(employee) : undefined;
  const page = Number(pageValue);
  if (
    product.length > 100 ||
    (employee && (!/^\d+$/.test(employee) || !Number.isSafeInteger(employeeId))) ||
    startDate === null ||
    endDate === null ||
    (startDate && endDate && startDate >= endDate) ||
    !/^\d+$/.test(pageValue) ||
    !Number.isSafeInteger(page) ||
    page < 1 ||
    eventValue.some((event) => !eventKinds.includes(event as EventoHistorico["evento"]))
  ) {
    return NextResponse.json({ error: "Filtros do histórico inválidos." }, { status: 400 });
  }

  try {
    const [requisicoes, auditorias] = await Promise.all([
      prisma.requisicao.findMany({
        where: {
          OR: [
            { status: "CONCLUIDA" },
            { status: "ANULADA" },
            { status: "ASSUMIDA" },
            { atendenteId: { not: null } },
          ],
        },
        include: {
          solicitante: { select: { id: true, nome: true, cracha: true } },
          atendente: { select: { id: true, nome: true, cracha: true } },
          itens: {
            include: {
              item: { select: { codigo: true, nome: true } },
              movimentacoes: {
                where: { tipo: "SAIDA" },
                select: { quantidade: true },
              },
            },
          },
        },
        orderBy: { atualizadoEm: "desc" },
        take: requestLimit,
      }),
      prisma.auditoria.findMany({
        where: { acao: "REQUISICAO_DEVOLVIDA" },
        include: {
          autor: { select: { id: true, cracha: true, nome: true } },
        },
        orderBy: { criadoEm: "desc" },
        take: auditLimit,
      }),
    ]);

    const events: EventoHistorico[] = [];
    for (const req of requisicoes) {
      const actor = req.atendente ?? req.solicitante;
      const products = req.itens.map((item) => ({
        codigo: item.item.codigo,
        nome: item.item.nome,
        descricao: decodeItemDescription(item.descricao).descricao || undefined,
        quantidadePedida: item.quantidade,
        quantidadeSeparada: item.movimentacoes.reduce((total, movement) => total + movement.quantidade, 0),
        motivo: item.motivoNaoAtendido ?? undefined,
      }));
      const itemDescription = products.map((item) =>
        `${item.nome}: pedido ${item.quantidadePedida}, separado ${item.quantidadeSeparada}${item.motivo ? ` (${item.motivo})` : ""}`,
      ).join("; ");
      const common = {
        requisicaoId: req.id,
        numeroPedido: req.numeroPedido,
        codigoCracha: actor.cracha,
        funcionarioId: actor.id,
        funcionarioNome: actor.nome,
        prioridade: req.prioridade === "PRIORITARIO" ? "prioridade" as const : "padrao" as const,
        produtos: products,
      };

      if (req.status === "CONCLUIDA" && req.concluidaEm) {
        events.push({
          ...common,
          id: `concluida-${req.id}`,
          evento: "finalizada",
          descricaoMotivo: itemDescription,
          timestamp: req.concluidaEm.toISOString(),
          itensFinalizados: req.itens.map((item, index) => ({
            nome: item.item.nome,
            quantidadePedida: item.quantidade,
            quantidadeSeparada: products[index].quantidadeSeparada,
            separado: Boolean(item.separado),
            motivo: item.motivoNaoAtendido ?? undefined,
          })),
        });
      }

      if (req.status === "ANULADA" && req.anuladaEm) {
        events.push({
          ...common,
          id: `anulada-${req.id}`,
          evento: "cancelada",
          descricaoMotivo: stripIdempotencyMetadata(req.observacao) ?? "Requisição cancelada.",
          timestamp: req.anuladaEm.toISOString(),
        });
      }

      if (req.status === "ASSUMIDA" && req.assumidaEm) {
        events.push({
          ...common,
          id: `assumida-${req.id}`,
          evento: "assumida",
          descricaoMotivo: null,
          timestamp: req.assumidaEm.toISOString(),
        });
      }
    }

    for (const audit of auditorias) {
      events.push({
        id: audit.id,
        requisicaoId: String(audit.alvoId),
        numeroPedido: audit.detalhes?.split(" ")[1] ?? `REQ-${audit.alvoId}`,
        evento: "devolvida",
        codigoCracha: audit.autor.cracha,
        funcionarioId: audit.autor.id,
        funcionarioNome: audit.autor.nome,
        descricaoMotivo: stripIdempotencyMetadata(audit.detalhes),
        timestamp: audit.criadoEm.toISOString(),
        produtos: [],
      });
    }

    const filters = {
      produto: product || undefined,
      funcionarioId: employeeId,
      desde: startDate ?? undefined,
      ateExclusive: endDate ?? undefined,
      eventos: eventValue as EventoHistorico["evento"][],
    };
    const filteredEvents = filterHistoricoEvents(events, filters);
    const paginated = paginateHistoricoEvents(filteredEvents, page, pageSize);
    const products = new Map<string, { codigo: string | null; nome: string }>();
    const employees = new Map<number, { id: number; nome: string; cracha: string }>();
    for (const event of events) {
      employees.set(event.funcionarioId, {
        id: event.funcionarioId,
        nome: event.funcionarioNome,
        cracha: event.codigoCracha,
      });
      for (const productOption of event.produtos) {
        products.set(`${productOption.codigo ?? ""}:${productOption.nome}`, {
          codigo: productOption.codigo,
          nome: productOption.nome,
        });
      }
    }

    return NextResponse.json({
      eventos: paginated.events,
      total: paginated.total,
      pagina: paginated.page,
      porPagina: paginated.pageSize,
      totalPaginas: paginated.totalPages,
      limiteRequisicoes: requestLimit,
      filtros: {
        produtos: [...products.values()].sort((first, second) => first.nome.localeCompare(second.nome, "pt-BR")),
        funcionarios: [...employees.values()].sort((first, second) => first.nome.localeCompare(second.nome, "pt-BR")),
      },
    });
  } catch (error) {
    console.error("Falha ao consultar histórico:", error instanceof Error ? error.message : "erro");
    return NextResponse.json(
      { error: "Não foi possível carregar o histórico." },
      { status: 500 }
    );
  }
}
