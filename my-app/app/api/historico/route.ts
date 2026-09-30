import { NextResponse } from "next/server"
import type { RowDataPacket } from "mysql2/promise"
import { db } from "../../../lib/mysql"
import type { EventoHistorico } from "../../../lib/types/almoxarifado"

type HistoryRow = RowDataPacket & {
  id: number; requisicao_id: number; numero_pedido: string; evento: EventoHistorico["evento"];
  codigo_cracha: string; descricao_motivo: string | null; ocorrido_em: Date;
  item_nome: string | null; separado: number | null; motivo_item: string | null;
} //a

export async function GET() {
  try {
    const [rows] = await db.execute<HistoryRow[]>(`
      SELECT h.id, h.requisicao_id, r.numero_pedido, h.evento, h.codigo_cracha,
        h.descricao_motivo, h.ocorrido_em, i.nome AS item_nome,
        hi.separado, hi.motivo_nao_atendido AS motivo_item
      FROM historico h
      JOIN requisicoes r ON r.id = h.requisicao_id
      LEFT JOIN historico_itens hi ON hi.historico_id = h.id
      LEFT JOIN requisicao_itens ri ON ri.id = hi.requisicao_item_id
      LEFT JOIN itens i ON i.id = ri.item_id
      ORDER BY h.ocorrido_em DESC, h.id DESC, hi.id ASC
    `)
    const events = new Map<number, EventoHistorico>()
    for (const row of rows) {
      let event = events.get(row.id)
      if (!event) {
        event = {
          id: String(row.id), requisicaoId: String(row.requisicao_id), numeroPedido: row.numero_pedido,
          evento: row.evento, codigoCracha: row.codigo_cracha, descricaoMotivo: row.descricao_motivo,
          timestamp: new Date(row.ocorrido_em).toISOString(), itensFinalizados: row.item_nome ? [] : undefined,
        }
        events.set(row.id, event)
      }
      if (row.item_nome && event.itensFinalizados) event.itensFinalizados.push({ nome: row.item_nome, separado: Boolean(row.separado), motivo: row.motivo_item ?? undefined })
    }
    return NextResponse.json({ eventos: [...events.values()] })
  } catch (error) {
    console.error("Falha ao consultar histórico no MySQL:", error)
    return NextResponse.json({ error: "Não foi possível carregar o histórico do MySQL." }, { status: 500 })
  }
}
