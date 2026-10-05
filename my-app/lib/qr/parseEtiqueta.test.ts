import { describe, expect, it } from "vitest";
import { normalizarCodigoEtiqueta, parseEtiqueta } from "./parseEtiqueta";

const codigosReais = [
  "6687", "4226", "7078", "9058", "129", "128", "127",
  "173", "7988", "17940", "1794", "1796", "1795", "5746",
];

describe("parseEtiqueta", () => {
  it.each(codigosReais)("aceita o código real %s", (codigo) => {
    expect(parseEtiqueta(codigo)).toEqual({ ok: true, codigo });
  });

  it("remove espaços, quebras de linha e caracteres invisíveis", () => {
    expect(parseEtiqueta(" \u200B12\r\n9 \uFEFF")).toEqual({ ok: true, codigo: "129" });
  });

  it("preserva zeros à esquerda para exibição e normaliza somente para comparação", () => {
    const parsed = parseEtiqueta("0129");
    expect(parsed).toEqual({ ok: true, codigo: "0129" });
    expect(parsed.ok && normalizarCodigoEtiqueta(parsed.codigo)).toBe("129");
  });

  it.each(["", " \n ", "ABC", "12-9", "123456789", "x".repeat(33)])(
    "rejeita payload inválido %j",
    (payload) => {
      expect(parseEtiqueta(payload).ok).toBe(false);
    },
  );
});
