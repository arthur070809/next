import { describe, expect, it } from "vitest";
import { escaparCsv } from "./csv";
import { podeVerMovimento } from "./permissoes";

describe("escaparCsv", () => {
  it("delimita e escapa aspas como CSV", () => {
    expect(escaparCsv('Peça "especial"')).toBe('"Peça ""especial"""');
  });

  it.each(["=1+1", "+SUM(A1:A2)", "-cmd", "@formula"])(
    "protege campos iniciados por fórmula: %s",
    (valor) => {
      expect(escaparCsv(valor)).toBe(`"'${valor}"`);
    },
  );

  it("normaliza valores ausentes sem sair de CSV válido", () => {
    expect(escaparCsv(null)).toBe('""');
    expect(escaparCsv(undefined)).toBe('""');
    expect(escaparCsv(42)).toBe('"42"');
  });
});

describe("podeVerMovimento", () => {
  const movimento = { funcionarioOrigemId: 12 };

  it("permite ao operador ver somente os movimentos próprios", () => {
    expect(podeVerMovimento("OPERADOR", 12, movimento)).toBe(true);
    expect(podeVerMovimento("OPERADOR", 13, movimento)).toBe(false);
  });

  it.each(["ADMIN", "ALMOXARIFE"])(
    "permite ao perfil %s ver todos os movimentos",
    (perfil) => {
      expect(podeVerMovimento(perfil, 99, movimento)).toBe(true);
    },
  );

  it("nega perfis desconhecidos", () => {
    expect(podeVerMovimento("USUARIO", 12, movimento)).toBe(false);
  });
});
