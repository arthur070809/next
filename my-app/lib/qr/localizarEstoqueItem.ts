import { normalizarCodigoEtiqueta } from "./parseEtiqueta";

export type StockQrItem = { id: string; codigo: string | null };

export type StockQrMatch =
  | { type: "not-found" }
  | { type: "ambiguous" }
  | { type: "found"; item: StockQrItem };

export function localizarItemEstoquePorCodigo(codigo: string, itens: readonly StockQrItem[]): StockQrMatch {
  const normalized = normalizarCodigoEtiqueta(codigo);
  const matches = itens.filter((item) =>
    item.codigo !== null && normalizarCodigoEtiqueta(item.codigo) === normalized,
  );
  if (matches.length > 1) return { type: "ambiguous" };
  if (matches.length === 0) return { type: "not-found" };
  return { type: "found", item: matches[0] };
}
