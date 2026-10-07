import TextoDescricao from "./TextoDescricao";

export default function ItemDescription({
  categoria,
  descricao,
  className = "",
}: {
  categoria?: string | null;
  descricao?: string | null;
  className?: string;
}) {
  return <div className={`min-w-0 break-words whitespace-pre-wrap ${className}`}>
    <p>Categoria: {categoria?.trim() || "—"}</p>
    <p>Descrição do pedido: <TextoDescricao value={descricao} /></p>
  </div>;
}
