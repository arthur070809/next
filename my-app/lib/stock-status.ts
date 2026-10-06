export const STOCK_STATUSES = ["SEM_ESTOQUE", "CRITICO", "REPOR", "DISPONIVEL"] as const;

export type StockStatus = (typeof STOCK_STATUSES)[number];

export function freeStock(quantidade: number, reservada: number): number {
  return Math.max(0, quantidade - reservada);
}

export function isAtOrBelowReorderPoint(
  quantidade: number,
  pontoPedido: number | null | undefined,
  reservada = 0,
): boolean {
  if (pontoPedido === null || pontoPedido === undefined || pontoPedido <= 0) return false;
  return freeStock(quantidade, reservada) <= pontoPedido;
}

export function getStockStatus(quantidade: number, estoqueSeguranca: number, pontoPedido: number): StockStatus {
  if (quantidade === 0) return "SEM_ESTOQUE";
  if (estoqueSeguranca > 0 && quantidade < estoqueSeguranca) return "CRITICO";
  if (pontoPedido > 0 && quantidade <= pontoPedido) return "REPOR";
  return "DISPONIVEL";
}

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  SEM_ESTOQUE: "Sem estoque",
  CRITICO: "Crítico",
  REPOR: "Repor",
  DISPONIVEL: "Disponível",
};