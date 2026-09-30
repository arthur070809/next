export const STOCK_STATUSES = ["SEM_ESTOQUE", "CRITICO", "REPOR", "DISPONIVEL"] as const;

export type StockStatus = (typeof STOCK_STATUSES)[number];

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