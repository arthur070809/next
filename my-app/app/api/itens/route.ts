import { NextResponse } from "next/server"
import type { RowDataPacket } from "mysql2/promise"
import { db } from "../../../lib/mysql"

type ItemRow = RowDataPacket & { id: number; nome: string; categoria: string; unidade_padrao: "UN" | "DZ" | "CT"; estoque_atual: number; almoxarifado: string }

export async function GET() {
  try {
    const [rows] = await db.execute<ItemRow[]>(`
      SELECT i.id, i.nome, i.categoria, i.unidade_padrao, i.estoque_atual, a.nome AS almoxarifado
      FROM itens i JOIN almoxarifados a ON a.id = i.almoxarifado_id
      WHERE i.ativo = TRUE AND a.ativo = TRUE
      ORDER BY i.nome ASC
    `)
    return NextResponse.json({ items: rows.map((row) => ({ id: row.id, nome: row.nome, categoria: row.categoria, unidadePadrao: row.unidade_padrao, estoqueAtual: row.estoque_atual, almoxarifado: row.almoxarifado })) })
  } catch (error) {
    console.error("Falha ao buscar catálogo no MySQL:", error)
    return NextResponse.json({ error: "Não foi possível carregar o catálogo do MySQL." }, { status: 500 })
  }
}
