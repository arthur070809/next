"use client"

import PriorityBadge from "./PriorityBadge"
import TextoDescricao from "./TextoDescricao"
import type { ItemFormData } from "./FormularioItem"
import { Button, EmptyState } from "./ui"

export default function ListaItensRequisicao({
  itens,
  onEdit,
  onRemove,
}: {
  itens: ItemFormData[]
  onEdit: (index: number) => void
  onRemove: (index: number) => void
}) {
  if (itens.length === 0) {
    return <EmptyState title="Nenhum item adicionado" message="Adicione materiais para revisar o pedido antes do envio." />
  }

  return (
    <div className="min-w-0">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[36rem] border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-background text-sm text-text-secondary">
            <tr className="border-b border-border-subtle">
              <th className="px-3 py-3">Item</th>
              <th className="px-3 py-3">Qtd.</th>
              <th className="px-3 py-3">Setor</th>
              <th className="px-3 py-3">Prioridade</th>
              <th className="px-3 py-3"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {itens.map((it, idx) => (
              <tr key={`${it.itemId}-${idx}`} className="align-top odd:bg-background/60 hover:bg-priority-surface">
                <td className="px-3 py-3">
                  <div className="font-medium text-foreground">{it.itemNome}</div>
                  <div className="text-sm text-text-secondary"><TextoDescricao value={it.descricao} /></div>
                </td>
                <td className="px-3 py-3">{it.quantidade} {it.unidadeMedida}</td>
                <td className="px-3 py-3">{it.setor}</td>
                <td className="px-3 py-3"><PriorityBadge priority={it.prioridade} /></td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => onEdit(idx)}>Editar</Button>
                    <Button variant="danger" onClick={() => onRemove(idx)}>Remover</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 md:hidden">
        {itens.map((it, idx) => (
          <article key={`${it.itemId}-${idx}`} className="grid gap-3 rounded-card bg-background p-4">
            <div>
              <h3 className="font-semibold text-foreground">{it.itemNome}</h3>
              <p className="mt-1 text-sm text-text-secondary"><TextoDescricao value={it.descricao} /></p>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="font-medium text-text-secondary">Quantidade</dt><dd>{it.quantidade} {it.unidadeMedida}</dd></div>
              <div><dt className="font-medium text-text-secondary">Setor</dt><dd>{it.setor}</dd></div>
              <div className="col-span-2"><dt className="mb-1 font-medium text-text-secondary">Prioridade</dt><dd><PriorityBadge priority={it.prioridade} /></dd></div>
            </dl>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => onEdit(idx)}>Editar</Button>
              <Button variant="danger" className="flex-1" onClick={() => onRemove(idx)}>Remover</Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
