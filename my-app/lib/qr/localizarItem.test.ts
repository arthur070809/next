import { describe, expect, it } from "vitest";
import { localizarItemDaEtiqueta } from "./localizarItem";

const produto = { id: "product-1", nome: "Rolamento", codigo: "00129" };
const item = { id: "request-item-1", itemId: "product-1", conferido: false };
const base = {
  codigo: "129",
  permitido: true,
  requisicaoAtiva: true,
  produtos: [produto],
  itens: [item],
};

describe("localizarItemDaEtiqueta", () => {
  it("localiza um item pendente pelo código, normalizando zeros à esquerda", () => {
    expect(localizarItemDaEtiqueta(base)).toEqual({ tipo: "encontrado", item, produto });
  });

  it("informa quando o item já foi conferido", () => {
    expect(localizarItemDaEtiqueta({
      ...base,
      itens: [{ ...item, conferido: true }],
    }).tipo).toBe("ja-conferido");
  });

  it("não confere novamente um item resolvido por outro estado", () => {
    expect(localizarItemDaEtiqueta({
      ...base,
      itens: [{ ...item, disponivel: false }],
    }).tipo).toBe("item-resolvido");
  });

  it("informa quando o produto existe mas não pertence à requisição", () => {
    expect(localizarItemDaEtiqueta({ ...base, itens: [] })).toEqual({
      tipo: "fora-da-requisicao",
      produto,
    });
  });

  it("informa código inexistente", () => {
    expect(localizarItemDaEtiqueta({ ...base, produtos: [] }).tipo).toBe("produto-inexistente");
  });

  it("não confunde código 1794 com seu prefixo 17940", () => {
    const longProduct = { id: "product-2", nome: "Pneu maior", codigo: "17940" };
    const longItem = { id: "request-item-2", itemId: "product-2", conferido: false };
    expect(localizarItemDaEtiqueta({
      ...base,
      codigo: "1794",
      produtos: [{ id: "short", nome: "Pneu", codigo: "1794" }, longProduct],
      itens: [longItem],
    })).toMatchObject({ tipo: "fora-da-requisicao", produto: { codigo: "1794" } });
  });

  it("recusa correspondência ambígua após remover zeros à esquerda", () => {
    expect(localizarItemDaEtiqueta({
      ...base,
      produtos: [produto, { id: "product-alias", nome: "Outro", codigo: "129" }],
      itens: [item],
    }).tipo).toBe("codigo-ambiguo");
  });

  it("nega perfil sem permissão", () => {
    expect(localizarItemDaEtiqueta({ ...base, permitido: false }).tipo).toBe("sem-permissao");
  });

  it("nega requisição fora de atendimento", () => {
    expect(localizarItemDaEtiqueta({ ...base, requisicaoAtiva: false }).tipo).toBe("requisicao-inativa");
  });
});
