export const demoRequestMarker = "TESTE DEMO REQUISICAO: seed:requisicao:v1";

export const demoRequestProducts = [
  { codigo: "ABR-12-34", quantidade: 1 },
  { codigo: "ARR-M8-IN", quantidade: 2 },
  { codigo: "CON-RET-8M", quantidade: 3 },
  { codigo: "DES-SPR-300", quantidade: 4 },
] as const;

export function matchesDemoRequest(
  request: { solicitanteId: number; itens: Array<{ item: { codigo: string | null } }> },
  operatorId: number,
) {
  const codes = request.itens.map(({ item }) => item.codigo).sort();
  const expectedCodes = demoRequestProducts.map(({ codigo }) => codigo).sort();
  return request.solicitanteId === operatorId &&
    codes.length === expectedCodes.length &&
    codes.every((code, index) => code === expectedCodes[index]);
}

export function canRemoveDemoRequest(request: {
  status: string;
  itens: Array<{ status: string }>;
}) {
  return (request.status === "PENDENTE" || request.status === "ASSUMIDA") &&
    request.itens.every((item) => item.status === "PENDENTE" || item.status === "ASSUMIDO");
}
