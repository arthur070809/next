"use client"

import Link from "next/link"
import type { RequisicaoMock } from "../../lib/types/almoxarifado"
import PriorityBadge from "./PriorityBadge"
import TextoDescricao from "./TextoDescricao"

type Props = {
  list: RequisicaoMock[]
  onAssume: (r: RequisicaoMock) => void
  onCancel: (r: RequisicaoMock) => void
  onReturn: (r: RequisicaoMock) => void
}

const warehouseName: Record<string, string> = { central: "Central", embalagens: "Embalagens", "materia-prima": "Matéria-prima", importados: "Produtos importados" }
const dateLabel = (value: string) => new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })

function Actions({ request, props }: { request: RequisicaoMock; props: Props }) {
  if (request.status === "assumida") return <div className="flex flex-wrap gap-2">
    <button onClick={() => props.onReturn(request)} className="rounded-lg border border-warning/30 px-3 py-2 text-xs font-semibold text-warning hover:bg-warning-surface">Devolver</button>
    <Link href={`/almoxarifado/requisicao/${encodeURIComponent(request.numeroPedido)}`} className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand-hover">Continuar / Abrir</Link>
  </div>
  return <div className="flex flex-wrap gap-2">
    <button onClick={() => props.onAssume(request)} className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand-hover">Assumir</button>
    <button onClick={() => props.onCancel(request)} className="rounded-lg border border-error/30 px-3 py-2 text-xs font-semibold text-error hover:bg-error-surface">Anular</button>
  </div>
}

export default function TabelaRequisicoes(props: Props) {
  const { list } = props
  if (list.length === 0) return <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center text-text-secondary">Nenhuma requisição pendente ou assumida corresponde aos filtros.</div>
  return <section className="overflow-hidden rounded-2xl border border-border-subtle bg-white shadow-sm">
    <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4"><div><h2 className="font-semibold text-foreground">Fila de atendimento</h2><p className="mt-1 text-sm text-text-secondary">{list.length} {list.length === 1 ? "requisição" : "requisições"} aguardando atendimento</p></div><span className="rounded-full bg-priority-surface px-3 py-1 text-xs font-semibold text-brand">Atualizada agora</span></div>
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[1180px] border-collapse text-left">
        <thead className="sticky top-0 z-10 bg-background text-xs uppercase tracking-wide text-text-secondary"><tr>{["Status", "Pedido", "Almoxarifado", "Setor", "Item", "Qtd.", "Unid.", "Data", "Cód.", "Prioridade", "Ações"].map((h) => <th key={h} className="border-b border-border-subtle px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
        <tbody>{list.map((r) => <tr key={r.numeroPedido} className={`border-b border-border-subtle last:border-0 hover:bg-background ${r.status === "assumida" ? "bg-warning-surface/50" : ""}`}>
          <td className="px-4 py-4">{r.status === "assumida" ? <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-surface px-2.5 py-1 text-xs font-semibold text-warning"><span className="h-1.5 w-1.5 rounded-full bg-warning"/>Assumida</span> : <span className="inline-flex items-center gap-1.5 rounded-full bg-priority-surface px-2.5 py-1 text-xs font-semibold text-brand"><span className="h-1.5 w-1.5 rounded-full bg-brand"/>Disponível</span>}</td>
          <td className="px-4 py-4 font-semibold text-foreground">{r.numeroPedido}</td><td className="px-4 py-4 text-sm text-text-secondary">{warehouseName[r.almoxarifado]}</td><td className="px-4 py-4 text-sm text-text-secondary">{r.setor}</td>          <td className="px-4 py-4 font-medium text-foreground">{r.item}<p className="mt-1 max-w-64 whitespace-normal text-xs font-normal text-text-secondary"><TextoDescricao value={r.descricao} /></p></td><td className="px-4 py-4 text-sm text-foreground">{r.quantidade}</td><td className="px-4 py-4 text-sm text-text-secondary">{r.unidadeMedida}</td><td className="whitespace-nowrap px-4 py-4 text-sm text-text-secondary">{dateLabel(r.data)}</td><td className="px-4 py-4 text-sm text-text-secondary">{r.codigoTratamento || "209"}</td><td className="px-4 py-4"><PriorityBadge priority={r.prioridade}/></td><td className="px-4 py-4"><Actions request={r} props={props}/></td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="space-y-3 p-3 md:hidden">{list.map((r) => <article key={r.numeroPedido} className={`rounded-xl border p-4 ${r.status === "assumida" ? "border-warning/30 bg-warning-surface/50" : "border-border-subtle bg-white"}`}>
      <div className="flex items-start justify-between gap-3"><div><div className="font-semibold text-foreground">{r.numeroPedido}</div><div className="mt-1 text-sm text-text-secondary">{warehouseName[r.almoxarifado]} · {r.setor}</div></div>{r.status === "assumida" ? <span className="rounded-full bg-warning-surface px-2.5 py-1 text-xs font-semibold text-warning">Assumida</span> : <span className="rounded-full bg-priority-surface px-2.5 py-1 text-xs font-semibold text-brand">Disponível</span>}</div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-text-secondary">Item</p><p className="font-medium text-foreground">{r.item}</p><p className="mt-1 text-xs text-text-secondary"><TextoDescricao value={r.descricao} /></p></div><div><p className="text-xs text-text-secondary">Quantidade</p><p>{r.quantidade} {r.unidadeMedida}</p></div><div><p className="text-xs text-text-secondary">Data</p><p>{dateLabel(r.data)}</p></div><div><p className="text-xs text-text-secondary">Prioridade</p><PriorityBadge priority={r.prioridade}/></div></div>
      <div className="mt-4"><Actions request={r} props={props}/></div>
    </article>)}</div>
  </section>
}
