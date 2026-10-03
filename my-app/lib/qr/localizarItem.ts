import { normalizarCodigoEtiqueta } from "./parseEtiqueta";

export type ProdutoEtiquetado = {
  id: string;
  nome: string;
  codigo: string | null;
};

export type ItemDaRequisicao = {
  id: string;
  itemId: string;
  conferido: boolean;
};

export type ResultadoLocalizacao =
  | { tipo: "sem-permissao" }
  | { tipo: "requisicao-inativa" }
  | { tipo: "produto-inexistente" }
  | { tipo: "fora-da-requisicao"; produto: ProdutoEtiquetado }
  | { tipo: "ja-conferido"; item: ItemDaRequisicao; produto: ProdutoEtiquetado }
  | { tipo: "encontrado"; item: ItemDaRequisicao; produto: ProdutoEtiquetado };

export function localizarItemDaEtiqueta(params: {
  codigo: string;
  permitido: boolean;
  requisicaoAtiva: boolean;
  produtos: ProdutoEtiquetado[];
  itens: ItemDaRequisicao[];
}): ResultadoLocalizacao {
  if (!params.permitido) return { tipo: "sem-permissao" };
  if (!params.requisicaoAtiva) return { tipo: "requisicao-inativa" };

  const codigoNormalizado = normalizarCodigoEtiqueta(params.codigo);
  const produtos = params.produtos.filter(
    (produto) =>
      produto.codigo !== null &&
      normalizarCodigoEtiqueta(produto.codigo) === codigoNormalizado,
  );
  if (produtos.length === 0) return { tipo: "produto-inexistente" };

  const produtoIds = new Set(produtos.map((produto) => produto.id));
  const item = params.itens.find((candidato) => produtoIds.has(candidato.itemId));
  if (!item) return { tipo: "fora-da-requisicao", produto: produtos[0] };

  const produto = produtos.find((candidate) => candidate.id === item.itemId);
  if (!produto) return { tipo: "produto-inexistente" };
  if (item.conferido) return { tipo: "ja-conferido", item, produto };
  return { tipo: "encontrado", item, produto };
}
