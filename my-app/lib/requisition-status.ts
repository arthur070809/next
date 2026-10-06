import { StatusRequisicao } from "@/generated/prisma/client";

export const REQUISITION_STATUS_LABELS = {
  [StatusRequisicao.PENDENTE]: "Aguardando atendimento",
  [StatusRequisicao.ASSUMIDA]: "Em atendimento",
  [StatusRequisicao.CONCLUIDA]: "Concluída",
  [StatusRequisicao.ANULADA]: "Cancelada",
} satisfies Record<StatusRequisicao, string>;
