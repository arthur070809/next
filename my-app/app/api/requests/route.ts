import { NextResponse } from "next/server"
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise"
import { db } from "../../../lib/mysql"

type RequisitionItemInput = { itemNome: string; setor: string; quantidade: number; unidadeMedida: string; descricao: string; prioridade: string }
type UserRow = RowDataPacket & { id: number }
type ItemRow = RowDataPacket & { id: number; almoxarifado_id: number }
const sectors = new Set(["setor1", "setor2", "setor3"])
const units = new Set(["UN", "DZ", "CT"])

export async function POST(request: Request) {
  let connection: PoolConnection | undefined
  try {
    const body = await request.json() as { solicitanteId?: number; itens?: RequisitionItemInput[] }
    const solicitanteId = Number(body.solicitanteId)
    if (!Number.isInteger(solicitanteId) || solicitanteId < 1 || !body.itens?.length || body.itens.length > 100) {
      return NextResponse.json({ error: "Informe o usuário solicitante e ao menos um item." }, { status: 400 })
    }
    for (const item of body.itens) {
      if (!item.itemNome?.trim() || !sectors.has(item.setor) || !Number.isFinite(Number(item.quantidade)) || Number(item.quantidade) <= 0 || !units.has(item.unidadeMedida) || !item.descricao?.trim() || !["padrao", "prioridade"].includes(item.prioridade)) {
        return NextResponse.json({ error: "Um ou mais itens da requisição têm dados inválidos." }, { status: 400 })
      }
    }

    connection = await db.getConnection()
    await connection.beginTransaction()
    const [users] = await connection.execute<UserRow[]>("SELECT id FROM usuarios WHERE id = ? AND ativo = TRUE LIMIT 1", [solicitanteId])
    if (!users[0]) {
      await connection.rollback()
      return NextResponse.json({ error: "O usuário solicitante não existe ou está inativo. Entre novamente." }, { status: 401 })
    }
    const [inserted] = await connection.execute<ResultSetHeader>("INSERT INTO requisicoes (solicitante_id, status) VALUES (?, 'pendente')", [solicitanteId])
    const numeroPedido = `#${String(inserted.insertId).padStart(4, "0")}`
    await connection.execute("UPDATE requisicoes SET numero_pedido = ? WHERE id = ?", [numeroPedido, inserted.insertId])

    for (const item of body.itens) {
      const [items] = await connection.execute<ItemRow[]>(
        "SELECT id, almoxarifado_id FROM itens WHERE nome = ? AND ativo = TRUE ORDER BY id ASC LIMIT 1",
        [item.itemNome.trim()],
      )
      if (!items[0]) {
        await connection.rollback()
        return NextResponse.json({ error: `O item “${item.itemNome}” não está cadastrado no catálogo.` }, { status: 422 })
      }
      await connection.execute(
        `INSERT INTO requisicao_itens
          (requisicao_id, item_id, almoxarifado_id, setor, quantidade, unidade_medida, descricao, prioridade, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendente')`,
        [inserted.insertId, items[0].id, items[0].almoxarifado_id, item.setor, Number(item.quantidade), item.unidadeMedida, item.descricao.trim(), item.prioridade],
      )
    }
    await connection.commit()
    return NextResponse.json({ message: "Requisição criada.", requisicaoId: inserted.insertId, numeroPedido }, { status: 201 })
  } catch (error) {
    if (connection) await connection.rollback().catch(() => undefined)
    console.error("Falha ao salvar requisição no MySQL:", error)
    return NextResponse.json({ error: "Não foi possível salvar a requisição no MySQL." }, { status: 500 })
  } finally {
    connection?.release()
  }
}
