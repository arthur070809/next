"use client"

import Link from "next/link"
import type { RequisicaoMock } from "../../lib/types/almoxarifado"
import PriorityBadge from "./PriorityBadge"

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
    <button onClick={() => props.onReturn(request)} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50">Devolver</button>
    <Link href={`/almoxarifado/requisicao/${encodeURIComponent(request.numeroPedido)}`} className="rounded-lg bg-royal px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">Continuar / Abrir</Link>
  </div>
  return <div className="flex flex-wrap gap-2">
    <button onClick={() => props.onAssume(request)} className="rounded-lg bg-royal px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">Assumir</button>
    <button onClick={() => props.onCancel(request)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">Anular</button>
  </div>
}

export default function TabelaRequisicoes(props: Props) {
  const { list } = props
  if (list.length === 0) return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">Nenhuma requisição pendente ou assumida corresponde aos filtros.</div>
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="font-semibold text-slate-900">Fila de atendimento</h2><p className="mt-1 text-sm text-slate-500">{list.length} {list.length === 1 ? "requisição" : "requisições"} aguardando atendimento</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-royal">Atualizada agora</span></div>
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[1180px] border-collapse text-left">
        <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{["Status", "Pedido", "Almoxarifado", "Setor", "Item", "Qtd.", "Unid.", "Data", "Cód.", "Prioridade", "Ações"].map((h) => <th key={h} className="border-b border-slate-200 px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
        <tbody>{list.map((r) => <tr key={r.numeroPedido} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 ${r.status === "assumida" ? "bg-amber-50/50" : ""}`}>
          <td className="px-4 py-4">{r.status === "assumida" ? <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800"><span className="h-1.5 w-1.5 rounded-full bg-amber-500"/>Assumida</span> : <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-royal"><span className="h-1.5 w-1.5 rounded-full bg-royal"/>Disponível</span>}</td>
          <td className="px-4 py-4 font-semibold text-slate-900">{r.numeroPedido}</td><td className="px-4 py-4 text-sm text-slate-600">{warehouseName[r.almoxarifado]}</td><td className="px-4 py-4 text-sm text-slate-600">{r.setor}</td><td className="px-4 py-4 font-medium text-slate-800">{r.item}{r.descricao && <p className="mt-1 max-w-64 whitespace-normal text-xs font-normal text-slate-500">{r.descricao}</p>}</td><td className="px-4 py-4 text-sm text-slate-700">{r.quantidade}</td><td className="px-4 py-4 text-sm text-slate-600">{r.unidadeMedida}</td><td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">{dateLabel(r.data)}</td><td className="px-4 py-4 text-sm text-slate-600">{r.codigoTratamento || "209"}</td><td className="px-4 py-4"><PriorityBadge priority={r.prioridade}/></td><td className="px-4 py-4"><Actions request={r} props={props}/></td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="space-y-3 p-3 md:hidden">{list.map((r) => <article key={r.numeroPedido} className={`rounded-xl border p-4 ${r.status === "assumida" ? "border-amber-200 bg-amber-50/50" : "border-slate-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-3"><div><div className="font-semibold text-slate-900">{r.numeroPedido}</div><div className="mt-1 text-sm text-slate-500">{warehouseName[r.almoxarifado]} · {r.setor}</div></div>{r.status === "assumida" ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Assumida</span> : <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-royal">Disponível</span>}</div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-slate-400">Item</p><p className="font-medium text-slate-800">{r.item}</p>{r.descricao && <p className="mt-1 text-xs text-slate-500">{r.descricao}</p>}</div><div><p className="text-xs text-slate-400">Quantidade</p><p>{r.quantidade} {r.unidadeMedida}</p></div><div><p className="text-xs text-slate-400">Data</p><p>{dateLabel(r.data)}</p></div><div><p className="text-xs text-slate-400">Prioridade</p><PriorityBadge priority={r.prioridade}/></div></div>
      <div className="mt-4"><Actions request={r} props={props}/></div>
    </article>)}</div>
  </section>
}
