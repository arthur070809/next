import { NextResponse } from "next/server";
import { getAuthenticatedFuncionario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const LOCAL_ESTOQUE_SLUG = "estoque";

export async function GET() {
  const funcionario = await getAuthenticatedFuncionario();
  if (!funcionario) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  try {
    const itens = await prisma.item.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        categoria: true,
        unidade: true,
        tipoUnidade: true,
        saldos: {
          where: { local: { slug: LOCAL_ESTOQUE_SLUG } },
          select: { quantidade: true, reservada: true, local: { select: { slug: true, nome: true } } },
        },
      },
    });

    return NextResponse.json({
      items: itens.map((item) => {
        const saldo = item.saldos[0];
        return {
          id: item.id,
          nome: item.nome,
          categoria: item.categoria,
          unidade: item.unidade,
          tipoUnidade: item.tipoUnidade,
          estoqueAtual: saldo?.quantidade ?? 0,
          reservada: saldo?.reservada ?? 0,
          disponivel: (saldo?.quantidade ?? 0) - (saldo?.reservada ?? 0),
          almoxarifado: saldo?.local?.nome ?? "Estoque Central",
        };
      }),
    });
  } catch (error) {
    console.error("Falha ao buscar catálogo de itens:", error instanceof Error ? error.message : "erro");
    return NextResponse.json({ error: "Não foi possível carregar o catálogo." }, { status: 500 });
  }
}
