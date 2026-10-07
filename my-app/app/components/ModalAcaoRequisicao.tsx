"use client"

import { useEffect, useRef, useState } from "react"
import type { RequisicaoMock } from "../../lib/types/almoxarifado"
import { Button, Icon } from "./ui"

type Acao = "assumir" | "anular" | "devolver"
export default function ModalAcaoRequisicao({ requisicao, acao, onClose, onConfirm, busy = false, titulo, descricao }: { requisicao: RequisicaoMock; acao: Acao; onClose: () => void; onConfirm: (r: RequisicaoMock, cracha: string, motivo: string) => void; busy?: boolean; titulo?: string; descricao?: string }) {
  const [cracha, setCracha] = useState("")
  const [motivo, setMotivo] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])
  const titles = { assumir: "Assumir requisição", anular: "Anular requisição", devolver: "Devolver requisição" }
  const valid = cracha.trim().length > 0 && (acao !== "anular" || motivo.trim().length > 0)
  const fieldClass = (invalid: boolean) => `mt-1 w-full rounded-lg border px-3 py-2.5 text-sm ${invalid && submitted ? "border-error" : "border-border"}`
  return <div className="fixed inset-0 z-50 grid place-items-end bg-foreground/60 sm:place-items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
    <section role="dialog" aria-modal="true" aria-labelledby="modal-title" className="safe-area-inset h-dvh w-full overflow-y-auto bg-white p-5 shadow-overlay sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-lg sm:rounded-panel sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-brand">{titulo ? "Viagem agrupada" : `Pedido ${requisicao.numeroPedido}`}</p><h2 id="modal-title" className="mt-1 text-xl font-semibold text-foreground">{titulo ?? titles[acao]}</h2><p className="mt-1 text-sm text-text-secondary">{descricao ?? `${requisicao.item} · ${requisicao.quantidade} ${requisicao.unidadeMedida}`}</p></div><button onClick={onClose} aria-label="Fechar" className="min-h-11 min-w-11 rounded-lg p-2 text-text-secondary hover:bg-background"><Icon name="close" /></button></div>
      {acao === "anular" && <label className="mb-4 block text-sm font-medium text-foreground">Motivo da anulação<input value={motivo} onChange={(e) => setMotivo(e.target.value)} className={fieldClass(!motivo.trim())} placeholder="Descreva o motivo" />{submitted && !motivo.trim() && <span className="mt-1 block text-xs text-error">Informe o motivo para continuar.</span>}</label>}
      <label className="block text-sm font-medium text-foreground">Código do crachá<input ref={inputRef} value={cracha} onChange={(e) => setCracha(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && valid) onConfirm(requisicao, cracha.trim(), motivo.trim()) }} className={fieldClass(!cracha.trim())} placeholder="Digite o código" />{submitted && !cracha.trim() && <span className="mt-1 block text-xs text-error">O código do crachá é obrigatório.</span>}</label>
      <div className="mt-6 flex flex-col-reverse justify-end gap-2 sm:flex-row"><Button variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button><Button variant={acao === "anular" ? "danger" : "primary"} loading={busy} loadingLabel="Salvando…" onClick={() => { setSubmitted(true); if (valid) onConfirm(requisicao, cracha.trim(), motivo.trim()) }}>Confirmar</Button></div>
    </section>
  </div>
}
