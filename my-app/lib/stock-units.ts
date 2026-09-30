export const STOCK_UNITS = [
  { value: "unidade", label: "Item único (unidade)", singular: "unidade", plural: "unidades", countLabel: "itens", baseUnit: "unidades" },
  { value: "caixa", label: "Caixa", singular: "caixa", plural: "caixas", countLabel: "caixas", baseUnit: "peças" },
  { value: "pacote", label: "Pacote", singular: "pacote", plural: "pacotes", countLabel: "pacotes", baseUnit: "peças" },
  { value: "saco", label: "Saco", singular: "saco", plural: "sacos", countLabel: "sacos", baseUnit: "peças" },
  { value: "kit", label: "Kit", singular: "kit", plural: "kits", countLabel: "kits", baseUnit: "peças" },
  { value: "rolo", label: "Rolo", singular: "rolo", plural: "rolos", countLabel: "rolos", baseUnit: "metros" },
  { value: "metro", label: "Metro", singular: "metro", plural: "metros", countLabel: "metros", baseUnit: "metros" },
] as const;

export type StockUnit = (typeof STOCK_UNITS)[number]["value"];

// Limite por campo de quantidade; o saldo final também deve caber em inteiro de 32 bits.
export const MAX_STOCK_INPUT = 1_000_000;
export const MAX_STOCK_BALANCE = 2_147_483_647;