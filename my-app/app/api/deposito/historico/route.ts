import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  const allowedTypes = ["SAIDA_REQUISICAO", "ENTRADA_SOBRA", "ENTRADA_MANUAL", "AJUSTE"] as const;
  const tipoFiltro = allowedTypes.includes(tipo as typeof allowedTypes[number]) ? tipo as typeof allowedTypes[number] : undefined;
  const criadoEm = dataInicio || dataFim
    ? { ...(dataInicio && !Number.isNaN(dataInicio.getTime()) ? { gte: dataInicio } : {}), ...(dataFim && !Number.isNaN(dataFim.getTime()) ? { lte: dataFim } : {}) }
    : undefined;

    const where = {
      ...(tipoFiltro ? { tipo: tipoFiltro } : {}),
      ...(criadoEm ? { criadoEm } : {}),
      ...(item ? { item: { OR: [
        { nome: { contains: item } },
        { codigo: { contains: item } },
      ] } } : {}),
      ...(usuario ? { usuario: { nome: { contains: usuario } } } : {}),
    };
    const [movimentacoes, total] = await Promise.all([
      prisma.movimentacaoDeposito.findMany({
        where,
        orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          item: { select: { id: true, nome: true, codigo: true } },
          usuario: { select: { id: true, nome: true } },
          requisicao: { select: { id: true, numero: true } },
        },
      }),
      prisma.movimentacaoDeposito.count({ where }),
    ]);
    return NextResponse.json({ movimentacoes, pagina: page, porPagina: pageSize, total, totalPaginas: Math.ceil(total / pageSize) });
  } catch (error) {
    const errorId = randomUUID();
    console.error("Falha ao carregar histórico do depósito", { errorId, errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível carregar o histórico.", errorId }, { status: 500 });
  }
}