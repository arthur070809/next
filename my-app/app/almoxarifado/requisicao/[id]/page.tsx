"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import type { ItemChecklist, RequisicaoMock } from "../../../../lib/types/almoxarifado"

function ModalCracha({ title, onClose, onConfirm, busy }: { title: string; onClose: () => void; onConfirm: (cracha: string) => void; busy: boolean }) {
  const [cracha, setCracha] = useState("")
  const [submitted, setSubmitted] = useState(false)
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h2 className="text-xl font-semibold text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-500">Informe o crachá de um almoxarife cadastrado.</p><label className="mt-5 block text-sm font-medium text-slate-700">Código do crachá<input autoFocus value={cracha} onChange={(e) => setCracha(e.target.value)} className={`mt-1 w-full rounded-lg border px-3 py-2.5 outline-none focus:ring-2 ${submitted && !cracha.trim() ? "border-red-500 focus:ring-red-100" : "border-slate-300 focus:border-royal focus:ring-blue-100"}`} placeholder="Digite o código"/>{submitted && !cracha.trim() && <span className="mt-1 block text-xs text-red-600">O código do crachá é obrigatório.</span>}</label><div className="mt-6 flex justify-end gap-2"><button onClick={onClose} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium">Cancelar</button><button disabled={busy} onClick={() => { setSubmitted(true); if (cracha.trim()) onConfirm(cracha.trim()) }} className="rounded-lg bg-royal px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Salvando…" : "Confirmar"}</button></div></div></div>
}

export function CabecalhoRequisicao({ request }: { request: RequisicaoMock }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-wider text-royal">Atendimento · {request.numeroPedido}</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Checklist da requisição</h1><p className="mt-1 text-sm text-slate-500">Solicitante: {request.solicitante ?? "Operador"} · {request.setor}</p></div><span className={`rounded-full px-3 py-1 text-sm font-semibold ${request.prioridade === "prioridade" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>{request.prioridade === "prioridade" ? "Prioridade" : "Padrão"}</span></div><div className="mt-5 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Data do pedido</p><p className="mt-1 text-sm text-slate-700">{new Date(request.data).toLocaleString("pt-BR")}</p></div><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Motivo informado</p><p className="mt-1 text-sm text-slate-700">{request.descricao}</p></div></div></section>
}

export function ChecklistItens({ items, checks, reasons, onCheck, onReason, showErrors }: { items: ItemChecklist[]; checks: Record<string, boolean>; reasons: Record<string, string>; onCheck: (id: string, checked: boolean) => void; onReason: (id: string, reason: string) => void; showErrors: boolean }) {
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Itens solicitados</h2><p className="mt-1 text-sm text-slate-500">Marque cada item separado. Informe o motivo para todo item que não for atendido.</p></div><div className="divide-y divide-slate-100">{items.map((item) => { const checked = Boolean(checks[item.id]); const missingReason = !checked && !reasons[item.id]?.trim(); return <article key={item.id} className="p-5 sm:p-6"><label className="flex cursor-pointer items-start gap-4"><input type="checkbox" checked={checked} onChange={(e) => onCheck(item.id, e.target.checked)} className="mt-1 h-5 w-5 rounded border-slate-300 accent-[#4169E1]"/><span className="min-w-0 flex-1"><span className="block font-semibold text-slate-900">{item.nome}</span><span className="mt-1 block text-sm text-slate-500">Solicitado: {item.quantidade} {item.unidadeMedida}</span></span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${checked ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}>{checked ? "Separado" : "Pendente"}</span></label>{!checked && <label className="mt-4 block pl-9 text-sm font-medium text-slate-700">Motivo não atendido<textarea value={reasons[item.id] ?? ""} onChange={(e) => onReason(item.id, e.target.value)} rows={2} className={`mt-1 w-full resize-y rounded-lg border px-3 py-2 outline-none focus:ring-2 ${showErrors && missingReason ? "border-red-500 focus:ring-red-100" : "border-slate-300 focus:border-royal focus:ring-blue-100"}`} placeholder="Ex.: sem estoque, item danificado"/>{showErrors && missingReason && <span className="mt-1 block text-xs text-red-600">Descreva por que este item não foi separado.</span>}</label>}</article>})}</div></section>
}

export function ModalTerminar(props: { onClose: () => void; onConfirm: (cracha: string) => void; busy: boolean }) { return <ModalCracha title="Terminar requisição" {...props}/> }
export function ModalDevolver(props: { onClose: () => void; onConfirm: (cracha: string) => void; busy: boolean }) { return <ModalCracha title="Devolver requisição" {...props}/> }

export default function RequisicaoChecklistPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const orderId = decodeURIComponent(params.id)
  const [request, setRequest] = useState<RequisicaoMock | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [apiError, setApiError] = useState("")
  const [checks, setChecks] = useState<Record<string, boolean>>({})
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [modal, setModal] = useState<"finish" | "return" | null>(null)
  const [showErrors, setShowErrors] = useState(false)

  useEffect(() => {
    fetch(`/api/almoxarifado/requisicoes/${encodeURIComponent(orderId)}`, { cache: "no-store" }).then(async (response) => {
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Falha ao buscar requisição.")
      setRequest(data.requisicao as RequisicaoMock)
    }).catch((error: unknown) => setApiError(error instanceof Error ? error.message : "Falha de conexão com o MySQL.")).finally(() => setLoading(false))
  }, [orderId])

  const items = useMemo(() => request?.itens ?? [], [request])
  const allMissingHaveReasons = items.every((item) => checks[item.id] || Boolean(reasons[item.id]?.trim()))

  async function complete(cracha: string, returned: boolean) {
    if (!request) return
    setBusy(true)
    setApiError("")
    try {
      const response = await fetch(`/api/almoxarifado/requisicoes/${encodeURIComponent(request.numeroPedido)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: returned ? "devolver" : "finalizar", codigoCracha: cracha, itens: items.map((item) => ({ id: item.id, separado: Boolean(checks[item.id]), motivo: checks[item.id] ? undefined : reasons[item.id]?.trim() })) }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível registrar a ação.")
      router.push("/almoxarifado")
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Falha ao gravar no MySQL.")
      setBusy(false)
    }
  }

  if (loading) return <main className="min-h-screen bg-[#f6f8fc] p-6"><div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm">Carregando requisição do MySQL…</div></main>
  if (!request) return <main className="min-h-screen bg-[#f6f8fc] p-6"><div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-bold text-slate-900">Requisição não encontrada</h1><p className="mt-2 text-sm text-slate-500">{apiError || "Ela pode ter sido removida ou concluída."}</p><Link href="/almoxarifado" className="mt-4 inline-block font-semibold text-royal">Voltar ao painel</Link></div></main>

  return <main className="min-h-screen bg-[#f6f8fc] px-4 py-6 sm:px-6 lg:px-8"><div className="mx-auto max-w-4xl"><div className="mb-5 flex items-center justify-between gap-3"><Link href="/almoxarifado" className="text-sm font-semibold text-royal hover:underline">← Voltar ao painel</Link><Link href="/historico" className="text-sm font-semibold text-slate-600 hover:text-royal">Histórico</Link></div><div className="space-y-5"><CabecalhoRequisicao request={request}/>{request.status === "assumida" ? <><ChecklistItens items={items} checks={checks} reasons={reasons} showErrors={showErrors} onCheck={(id, checked) => setChecks((old) => ({ ...old, [id]: checked }))} onReason={(id, reason) => setReasons((old) => ({ ...old, [id]: reason }))}/>{showErrors && !allMissingHaveReasons && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Preencha o motivo de cada item que não foi separado.</p>}</> : <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Esta requisição não está mais em atendimento. Volte ao painel para atualizar a fila.</p>}{apiError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{apiError}</p>}{request.status === "assumida" && <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row"><button onClick={() => setModal("return")} className="rounded-lg border border-amber-300 bg-white px-4 py-3 text-sm font-semibold text-amber-800 hover:bg-amber-50">Devolver requisição</button><button onClick={() => { setShowErrors(true); if (allMissingHaveReasons) setModal("finish") }} className="rounded-lg bg-royal px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">Terminar requisição</button></div>}</div></div>{modal === "finish" && <ModalTerminar busy={busy} onClose={() => setModal(null)} onConfirm={(cracha) => void complete(cracha, false)}/ >}{modal === "return" && <ModalDevolver busy={busy} onClose={() => setModal(null)} onConfirm={(cracha) => void complete(cracha, true)}/>}</main>
}
