import { NextResponse } from "next/server"
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise"
import { db } from "../../../../../lib/mysql"
import { getAuthenticatedFuncionario } from "../../../../../lib/auth"
import { isSameOrigin } from "../../../../../lib/security"
import { getRequisition } from "../../../../../lib/requisicoes-db"

type RequestRow = RowDataPacket & { id: number; status: "pendente" | "assumida" | "concluida" | "anulada" }
type UserRow = RowDataPacket & { id: number; role: "operador" | "almoxarife" | "admin" }
type ItemRow = RowDataPacket & { id: number }
type CompletionItem = { id: string | number; separado: boolean; motivo?: string }
type ActionBody = { action?: string; codigoCracha?: string; descricaoMotivo?: string; itens?: CompletionItem[] }
type RouteContext = { params: Promise<unknown> }

const badRequest = (message: string, status = 400) => NextResponse.json({ error: message }, { status })

function getNumeroPedido(params: unknown) {
  if (typeof params !== "object" || params === null || !("numeroPedido" in params)) return null
  return typeof params.numeroPedido === "string" ? params.numeroPedido : null
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    if (!(await getAuthenticatedFuncionario())) return badRequest("Não autenticado.", 401)
    const numeroPedido = getNumeroPedido(await params)
    if (!numeroPedido) return badRequest("Número da requisição inválido.")
    const requisicao = await getRequisition(decodeURIComponent(numeroPedido))
    if (!requisicao) return badRequest("Requisição não encontrada.", 404)
    return NextResponse.json({ requisicao })
  } catch (error) {
    console.error("Falha ao consultar requisição no MySQL:", error)
    return badRequest("Não foi possível consultar a requisição no MySQL.", 500)
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  let connection: PoolConnection | undefined
  try {
    if (!(await getAuthenticatedFuncionario())) return badRequest("Não autenticado.", 401)
    if (!isSameOrigin(request)) return badRequest("Origem inválida.", 403)
    const encodedNumber = getNumeroPedido(await params)
    if (!encodedNumber) return badRequest("Número da requisição inválido.")
    const numeroPedido = decodeURIComponent(encodedNumber)
    const body = await request.json() as ActionBody
    const action = body.action
    const badge = body.codigoCracha?.trim()
    if (!badge) return badRequest("Informe o código do crachá.")
    if (!["assumir", "devolver", "anular", "finalizar"].includes(action ?? "")) return badRequest("Ação inválida.")
    if (action === "anular" && !body.descricaoMotivo?.trim()) return badRequest("Informe o motivo da anulação.")

    connection = await db.getConnection()
    await connection.beginTransaction()
    const [requests] = await connection.execute<RequestRow[]>("SELECT id, status FROM requisicoes WHERE numero_pedido = ? FOR UPDATE", [numeroPedido])
    const requisicao = requests[0]
    if (!requisicao) {
      await connection.rollback()
      return badRequest("Requisição não encontrada.", 404)
    }
    const [users] = await connection.execute<UserRow[]>("SELECT id, role FROM usuarios WHERE codigo_cracha = ? AND ativo = TRUE LIMIT 1", [badge])
    const actor = users[0]
    if (!actor || !["almoxarife", "admin"].includes(actor.role)) {
      await connection.rollback()
      return badRequest("Crachá não cadastrado como almoxarife ativo.", 403)
    }

    const allowed = action === "assumir" ? requisicao.status === "pendente"
      : action === "devolver" || action === "finalizar" ? requisicao.status === "assumida"
      : requisicao.status === "pendente"
    if (!allowed) {
      await connection.rollback()
      return badRequest("A requisição já mudou de status. Atualize a fila antes de tentar novamente.", 409)
    }

    let event: "assumida" | "devolvida" | "finalizada" | "cancelada"
    if (action === "assumir") {
      await connection.execute("UPDATE requisicoes SET status = 'assumida', assumida_por = ?, assumida_em = CURRENT_TIMESTAMP(3) WHERE id = ?", [actor.id, requisicao.id])
      await connection.execute("UPDATE requisicao_itens SET status = 'assumida' WHERE requisicao_id = ? AND status = 'pendente'", [requisicao.id])
      event = "assumida"
    } else if (action === "devolver") {
      await connection.execute("UPDATE requisicoes SET status = 'pendente', assumida_por = NULL, assumida_em = NULL WHERE id = ?", [requisicao.id])
      await connection.execute("UPDATE requisicao_itens SET status = 'pendente' WHERE requisicao_id = ? AND status = 'assumida'", [requisicao.id])
      event = "devolvida"
    } else if (action === "anular") {
      await connection.execute("UPDATE requisicoes SET status = 'anulada', anulada_em = CURRENT_TIMESTAMP(3) WHERE id = ?", [requisicao.id])
      await connection.execute("UPDATE requisicao_itens SET status = 'anulada' WHERE requisicao_id = ?", [requisicao.id])
      event = "cancelada"
    } else {
      const [items] = await connection.execute<ItemRow[]>("SELECT id FROM requisicao_itens WHERE requisicao_id = ? FOR UPDATE", [requisicao.id])
      const outcomes = body.itens ?? []
      const itemIds = new Set(outcomes.map((item) => String(item.id)))
      if (outcomes.length !== items.length || items.some((item) => !itemIds.has(String(item.id))) || outcomes.some((item) => !item.separado && !item.motivo?.trim())) {
        await connection.rollback()
        return badRequest("Informe se cada item foi separado; os itens não separados precisam de um motivo.")
      }
      await connection.execute("UPDATE requisicoes SET status = 'concluida', concluida_em = CURRENT_TIMESTAMP(3) WHERE id = ?", [requisicao.id])
      const [historyResult] = await connection.execute<ResultSetHeader>("INSERT INTO historico (requisicao_id, usuario_id, codigo_cracha, evento) VALUES (?, ?, ?, 'finalizada')", [requisicao.id, actor.id, badge])
      for (const item of outcomes) {
        const reason = item.separado ? null : item.motivo!.trim()
        await connection.execute("UPDATE requisicao_itens SET status = 'concluida', separado = ?, motivo_nao_atendido = ? WHERE id = ? AND requisicao_id = ?", [item.separado, reason, item.id, requisicao.id])
        await connection.execute("INSERT INTO historico_itens (historico_id, requisicao_item_id, separado, motivo_nao_atendido) VALUES (?, ?, ?, ?)", [historyResult.insertId, item.id, item.separado, reason])
      }
      await connection.commit()
      return NextResponse.json({ message: "Requisição finalizada." })
    }

    await connection.execute("INSERT INTO historico (requisicao_id, usuario_id, codigo_cracha, evento, descricao_motivo) VALUES (?, ?, ?, ?, ?)", [requisicao.id, actor.id, badge, event, event === "cancelada" || event === "devolvida" ? body.descricaoMotivo?.trim() || null : null])
    await connection.commit()
    return NextResponse.json({ message: "Ação registrada.", evento: event })
  } catch (error) {
    if (connection) await connection.rollback().catch(() => undefined)
    console.error("Falha ao alterar requisição no MySQL:", error)
    return badRequest("Não foi possível registrar a ação no MySQL.", 500)
  } finally {
    connection?.release()
  }
}
