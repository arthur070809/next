"use client"

import { useEffect, useRef, useState } from "react"
import type { RequisicaoMock } from "../../lib/types/almoxarifado"

type Acao = "assumir" | "anular" | "devolver"
export default function ModalAcaoRequisicao({ requisicao, acao, onClose, onConfirm, busy = false, titulo, descricao }: { requisicao: RequisicaoMock; acao: Acao; onClose: () => void; onConfirm: (r: RequisicaoMock, cracha: string, motivo: string) => void; busy?: boolean; titulo?: string; descricao?: string }) {
  const [cracha, setCracha] = useState("")
  const [motivo, setMotivo] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])
  const titles = { assumir: "Assumir requisição", anular: "Anular requisição", devolver: "Devolver requisição" }
  const valid = cracha.trim().length > 0 && (acao !== "anular" || motivo.trim().length > 0)
  const fieldClass = (invalid: boolean) => `mt-1 w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 ${invalid && submitted ? "border-red-500 focus:ring-red-100" : "border-slate-300 focus:border-royal focus:ring-blue-100"}`
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
    <section role="dialog" aria-modal="true" aria-labelledby="modal-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
      <div className="mb-5 flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-royal">{titulo ? "Viagem agrupada" : `Pedido ${requisicao.numeroPedido}`}</p><h2 id="modal-title" className="mt-1 text-xl font-semibold text-slate-900">{titulo ?? titles[acao]}</h2><p className="mt-1 text-sm text-slate-500">{descricao ?? `${requisicao.item} · ${requisicao.quantidade} ${requisicao.unidadeMedida}`}</p></div><button onClick={onClose} aria-label="Fechar" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">✕</button></div>
      {acao === "anular" && <label className="mb-4 block text-sm font-medium text-slate-700">Motivo da anulação<input value={motivo} onChange={(e) => setMotivo(e.target.value)} className={fieldClass(!motivo.trim())} placeholder="Descreva o motivo" />{submitted && !motivo.trim() && <span className="mt-1 block text-xs text-red-600">Informe o motivo para continuar.</span>}</label>}
      <label className="block text-sm font-medium text-slate-700">Código do crachá<input ref={inputRef} value={cracha} onChange={(e) => setCracha(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && valid) onConfirm(requisicao, cracha.trim(), motivo.trim()) }} className={fieldClass(!cracha.trim())} placeholder="Digite o código" />{submitted && !cracha.trim() && <span className="mt-1 block text-xs text-red-600">O código do crachá é obrigatório.</span>}</label>
      <div className="mt-6 flex justify-end gap-2"><button onClick={onClose} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancelar</button><button disabled={busy} onClick={() => { setSubmitted(true); if (valid) onConfirm(requisicao, cracha.trim(), motivo.trim()) }} className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-50 ${acao === "anular" ? "bg-red-600 hover:bg-red-700" : "bg-royal hover:bg-blue-700"}`}>{busy ? "Salvando..." : "Confirmar"}</button></div>
    </section>
  </div>
}
