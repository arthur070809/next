import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TipoMovimentacao } from "@/generated/prisma/client";

const LOCAL_DEPOSITO_SLUG = "deposito";

// Os filtros da tela usam os nomes antigos; aqui viram os tipos do modelo novo.
const TIPO_FILTRO: Record<string, TipoMovimentacao> = {
  SAIDA_REQUISICAO: TipoMovimentacao.SAIDA,
  ENTRADA_SOBRA: TipoMovimentacao.ENTRADA,
  ENTRADA_MANUAL: TipoMovimentacao.ENTRADA,
  AJUSTE: TipoMovimentacao.AJUSTE,
};

const TIPO_TELA: Record<string, string> = {
  ENTRADA: "ENTRADA_MANUAL",
  SAIDA: "SAIDA_REQUISICAO",
  AJUSTE: "AJUSTE",
};

export async function GET(request: Request) {
  try {
    if (!(await getAuthenticatedFuncionario())) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    const params = new URL(request.url).searchParams;
    const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
    const pageSize = 25;
    const item = params.get("item")?.trim() ?? "";
    const tipo = params.get("tipo") ?? "";
    const usuario = params.get("usuario")?.trim() ?? "";
    const inicio = params.get("inicio");
    const fim = params.get("fim");
    const dataInicio = inicio ? new Date(`${inicio}T03:00:00.000Z`) : null;
    const dataFim = fim ? new Date(`${fim}T02:59:59.999Z`) : null;
    if (dataFim) dataFim.setUTCDate(dataFim.getUTCDate() + 1);
    const tipoFiltro = TIPO_FILTRO[tipo];
    const criadoEm = dataInicio || dataFim
      ? {
          ...(dataInicio && !Number.isNaN(dataInicio.getTime()) ? { gte: dataInicio } : {}),
          ...(dataFim && !Number.isNaN(dataFim.getTime()) ? { lte: dataFim } : {}),
        }
      : undefined;

    const where = {
      saldoEstoque: {
        local: { slug: LOCAL_DEPOSITO_SLUG },
        ...(item ? { item: { OR: [{ nome: { contains: item } }, { codigo: { contains: item } }] } } : {}),
      },
      ...(tipoFiltro ? { tipo: tipoFiltro } : {}),
      ...(criadoEm ? { criadoEm } : {}),
      ...(usuario ? { funcionario: { nome: { contains: usuario } } } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.movimentacao.findMany({
        where,
        orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          saldoEstoque: { select: { item: { select: { id: true, nome: true, codigo: true } } } },
          funcionario: { select: { id: true, nome: true } },
          requisicao: { select: { id: true, numeroPedido: true } },
        },
      }),
      prisma.movimentacao.count({ where }),
    ]);

    const movimentacoes = rows.map((row) => ({
      id: row.id,
      tipo: TIPO_TELA[row.tipo] ?? row.tipo,
      quantidade: row.quantidade,
      saldoAntes: row.tipo === "ENTRADA" ? row.saldoApos - row.quantidade : row.tipo === "SAIDA" ? row.saldoApos + row.quantidade : null,
      saldoDepois: row.saldoApos,
      motivo: row.observacao,
      criadoEm: row.criadoEm,
      item: row.saldoEstoque.item,
      usuario: row.funcionario,
      requisicao: row.requisicao ? { id: row.requisicao.id, numero: row.requisicao.numeroPedido } : null,
    }));

    return NextResponse.json({ movimentacoes, pagina: page, porPagina: pageSize, total, totalPaginas: Math.ceil(total / pageSize) });
  } catch (error) {
    const errorId = randomUUID();
    console.error("Falha ao carregar histórico do depósito", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível carregar o histórico.", errorId }, { status: 500 });
  }
}