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

  it.each([
    ["https://etiquetas.marcon.local/item?codigo=1794", "1794"],
    ["https://etiquetas.marcon.local/item/17940", "17940"],
    ['{"sku":"1794"}', "1794"],
    ["Código: 1794", "1794"],
    ["produto=17940", "17940"],
    [" 1794\n", "1794"],
  ])("aceita formatos estruturados sem confundir códigos: %s", (payload, codigo) => {
    expect(parseEtiqueta(payload)).toEqual({ ok: true, codigo });
  });

  it("normaliza Unicode NFKC e mantém a igualdade exata dos códigos próximos", () => {
    expect(parseEtiqueta("１７９４")).toEqual({ ok: true, codigo: "1794" });
    expect(parseEtiqueta("17940")).toEqual({ ok: true, codigo: "17940" });
  });

  it.each([
    "texto aleatório sem código",
    "códigos 1794 e 17940",
    '{"codigo":"1794","sku":"17940"}',
  ])("rejeita conteúdo ilegível ou ambíguo %j", (payload) => {
    expect(parseEtiqueta(payload).ok).toBe(false);
  });

  it.each(["", " \n ", "ABC", "12-9", "123456789", "x".repeat(33)])(
    "rejeita payload inválido %j",
    (payload) => {
      expect(parseEtiqueta(payload).ok).toBe(false);
    },
  );
});
