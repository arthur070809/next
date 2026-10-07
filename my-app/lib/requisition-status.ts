import type { StatusRequisicao } from "@/generated/prisma/client";

export const REQUISITION_STATUS_LABELS = {
  PENDENTE: "Aguardando atendimento",
  ASSUMIDA: "Em atendimento",
  CONCLUIDA: "Concluída",
  ANULADA: "Cancelada",
} satisfies Record<StatusRequisicao, string>;
