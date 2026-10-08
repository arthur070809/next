import type { ItemChecklist } from "@/lib/types/almoxarifado";

type QueueListItem = Pick<ItemChecklist, "id" | "nome" | "unidadeMedida"> & {
  quantidade?: number;
};

export default function QueueItemList({ items }: { items?: QueueListItem[] }) {
  const visibleItems = items?.slice(0, 3) ?? [];
  const remainingCount = Math.max((items?.length ?? 0) - visibleItems.length, 0);

  return (
    <ul className="mt-1 min-w-0 space-y-1">
      {visibleItems.map((item) => (
        <li key={item.id} className="flex min-w-0 items-baseline gap-2 text-xs">
          <span className="min-w-0 flex-1 truncate text-foreground" title={item.nome}>{item.nome}</span>
          {item.quantidade != null && (
            <span className="shrink-0 whitespace-nowrap text-text-secondary">
              {item.quantidade}{item.unidadeMedida ? ` ${item.unidadeMedida}` : ""}
            </span>
          )}
        </li>
      ))}
      {remainingCount > 0 && (
        <li className="text-xs text-text-secondary">+{remainingCount} {remainingCount === 1 ? "item" : "itens"}</li>
      )}
    </ul>
  );
}
