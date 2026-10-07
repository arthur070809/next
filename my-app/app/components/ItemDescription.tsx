import RequisitionDescription from "./RequisitionDescription";

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
    <div className="min-w-0"><span>Descrição do pedido: </span><RequisitionDescription value={descricao} /></div>
  </div>;
}
