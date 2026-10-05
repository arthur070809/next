import type { RequisicaoViagemInput } from "./planejar-viagens";

export const locaisDemonstracao = [
  { id: "demo-consumiveis", nome: "Consumíveis" },
  { id: "demo-materia-prima", nome: "Matéria-prima" },
  { id: "demo-componentes", nome: "Componentes" },
  { id: "demo-embalagens", nome: "Embalagens" },
] as const;

const [consumiveis, materiaPrima, componentes] = locaisDemonstracao;

export const requisicoesDemonstracao: readonly RequisicaoViagemInput[] = [
  {
    id: "demo-req-101",
    numeroPedido: "DEMO-101",
    prioridade: "PRIORITARIO",
    criadoEm: "2026-10-03T08:10:00.000Z",
    itens: [
      { itemId: "demo-item-arruela", nome: "Arruela lisa M8", quantidade: 12, local: consumiveis },
      { itemId: "demo-item-luva", nome: "Luva de proteção", quantidade: 4, local: consumiveis },
    ],
  },
  {
    id: "demo-req-102",
    numeroPedido: "DEMO-102",
    prioridade: "PADRAO",
    criadoEm: "2026-10-03T08:25:00.000Z",
    itens: [
      { itemId: "demo-item-resina", nome: "Resina técnica azul", quantidade: 2, local: materiaPrima },
      { itemId: "demo-item-arruela", nome: "Arruela lisa M8", quantidade: 8, local: consumiveis },
    ],
  },
  {
    id: "demo-req-103",
    numeroPedido: "DEMO-103",
    prioridade: "PADRAO",
    criadoEm: "2026-10-03T08:40:00.000Z",
    itens: [
      { itemId: "demo-item-conector", nome: "Conector reto 12 mm", quantidade: 6, local: componentes },
      { itemId: "demo-item-mola", nome: "Mola de retorno", quantidade: 3, local: componentes },
      { itemId: "demo-item-fita", nome: "Fita de marcação verde", quantidade: 2, local: consumiveis },
    ],
  },
  {
    id: "demo-req-104",
    numeroPedido: "DEMO-104",
    prioridade: "PRIORITARIO",
    criadoEm: "2026-10-03T09:05:00.000Z",
    itens: [
      { itemId: "demo-item-perfil", nome: "Perfil de alumínio curto", quantidade: 5, local: materiaPrima },
      { itemId: "demo-item-conector", nome: "Conector reto 12 mm", quantidade: 3, local: componentes },
    ],
  },
  {
    id: "demo-req-105",
    numeroPedido: "DEMO-105",
    prioridade: "PADRAO",
    criadoEm: "2026-10-03T09:20:00.000Z",
    itens: [
      { itemId: "demo-item-luva", nome: "Luva de proteção", quantidade: 2, local: consumiveis },
      { itemId: "demo-item-mola", nome: "Mola de retorno", quantidade: 2, local: componentes },
      { itemId: "demo-item-porca", nome: "Porca sextavada M8", quantidade: 10, local: consumiveis },
      { itemId: "demo-item-resina", nome: "Resina técnica azul", quantidade: 1, local: materiaPrima },
    ],
  },
  {
    id: "demo-req-106",
    numeroPedido: "DEMO-106",
    prioridade: "PADRAO",
    criadoEm: "2026-10-03T09:45:00.000Z",
    itens: [
      { itemId: "demo-item-perfil", nome: "Perfil de alumínio curto", quantidade: 2, local: materiaPrima },
      { itemId: "demo-item-fita", nome: "Fita de marcação verde", quantidade: 5, local: consumiveis },
    ],
  },
];
