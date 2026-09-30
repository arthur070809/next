import type { Pool, RowDataPacket } from "mysql2/promise"
import { db } from "./mysql"
import type { RequisicaoMock } from "./types/almoxarifado"

type RequisicaoRow = RowDataPacket & {
  requisicao_id: number
  numero_pedido: string
  status_requisicao: RequisicaoMock["status"]
  criada_em: Date
  solicitante: string | null
  assumida_por_cracha: string | null
  assumida_em: Date | null
  setor: string | null
  nome_item: string | null
  quantidade: number | null
  unidade_medida: string | null
  descricao: string | null
  prioridade: "padrao" | "prioridade" | null
  item_status: RequisicaoMock["status"] | null
  item_id: number | null
  almoxarifado_slug: string | null
}

const warehouseSlugs = ["central", "embalagens", "materia-prima", "importados"] as const

async function fetchRows(pool: Pool, where: string, params: Array<string | number | Date | null> = []) {
  const [rows] = await pool.execute<RequisicaoRow[]>(`
    SELECT r.id AS requisicao_id, r.numero_pedido, r.status AS status_requisicao,
      r.criada_em, r.assumida_em, ua.codigo_cracha AS assumida_por_cracha,
      u.nome AS solicitante, ri.id AS item_id, ri.setor, ri.quantidade,
      ri.unidade_medida, ri.descricao, ri.prioridade, ri.status AS item_status,
      i.nome AS nome_item, a.slug AS almoxarifado_slug
    FROM requisicoes r
    LEFT JOIN usuarios u ON u.id = r.solicitante_id
    LEFT JOIN usuarios ua ON ua.id = r.assumida_por
    LEFT JOIN requisicao_itens ri ON ri.requisicao_id = r.id
    LEFT JOIN itens i ON i.id = ri.item_id
    LEFT JOIN almoxarifados a ON a.id = ri.almoxarifado_id
    ${where}
    ORDER BY (ri.prioridade = 'prioridade') DESC, r.criada_em ASC, ri.id ASC
  `, params)
  const requests = new Map<number, RequisicaoMock>()
  for (const row of rows) {
    let request = requests.get(row.requisicao_id)
    if (!request) {
      request = {
        numeroPedido: row.numero_pedido,
        almoxarifado: warehouseSlugs.includes(row.almoxarifado_slug as (typeof warehouseSlugs)[number]) ? row.almoxarifado_slug as RequisicaoMock["almoxarifado"] : "central",
        setor: (row.setor ?? "setor1") as RequisicaoMock["setor"],
        item: row.nome_item ?? "Sem itens",
        quantidade: Number(row.quantidade ?? 0),
        unidadeMedida: (row.unidade_medida ?? "UN").toLowerCase() as RequisicaoMock["unidadeMedida"],
        descricao: row.descricao ?? "",
        data: new Date(row.criada_em).toISOString(),
        codigoTratamento: "209",
        prioridade: row.prioridade ?? "padrao",
        status: row.status_requisicao,
        solicitante: row.solicitante ?? "Solicitante",
        assumidaPorCracha: row.assumida_por_cracha ?? undefined,
        assumidaAt: row.assumida_em ? new Date(row.assumida_em).toISOString() : undefined,
        itens: [],
      }
      requests.set(row.requisicao_id, request)
    }
    if (row.item_id !== null) {
      const item = { id: String(row.item_id), nome: row.nome_item ?? "Item", quantidade: Number(row.quantidade ?? 0), unidadeMedida: row.unidade_medida ?? "UN" }
      request.itens?.push(item)
      if (request.itens?.length === 1) {
        request.item = item.nome
        request.quantidade = item.quantidade
        request.unidadeMedida = item.unidadeMedida.toLowerCase() as RequisicaoMock["unidadeMedida"]
        request.descricao = row.descricao ?? ""
        request.setor = (row.setor ?? "setor1") as RequisicaoMock["setor"]
        request.almoxarifado = warehouseSlugs.includes(row.almoxarifado_slug as (typeof warehouseSlugs)[number]) ? row.almoxarifado_slug as RequisicaoMock["almoxarifado"] : "central"
      }
      if (row.prioridade === "prioridade") request.prioridade = "prioridade"
    }
  }
  return [...requests.values()]
}

export function listOpenRequisitions() {
  return fetchRows(db, "WHERE r.status IN ('pendente', 'assumida')")
}

export async function getRequisition(numeroPedido: string) {
  const requests = await fetchRows(db, "WHERE r.numero_pedido = ?", [numeroPedido])
  return requests[0] ?? null
}
