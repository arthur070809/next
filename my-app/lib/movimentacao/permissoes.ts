export interface MovimentoComOrigemFuncionario {
  funcionarioOrigemId: number;
}

export function podeVerMovimento(
  perfil: string,
  funcionarioId: number,
  movimento: MovimentoComOrigemFuncionario,
): boolean {
  if (perfil === "ADMIN" || perfil === "ALMOXARIFE") {
    return true;
  }
  return perfil === "OPERADOR" && funcionarioId === movimento.funcionarioOrigemId;
}
