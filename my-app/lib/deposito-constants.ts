export const MAX_MANUAL_DEPOSIT_QUANTITY = 100_000;

export const MANUAL_DEPOSIT_REASONS = {
  SEM_REQUISICAO: "Sobra sem requisição registrada",
  CONTAGEM_INICIAL: "Contagem inicial do depósito",
  OUTRO: "Outro",
} as const;

export type ManualDepositReason = typeof MANUAL_DEPOSIT_REASONS[keyof typeof MANUAL_DEPOSIT_REASONS];