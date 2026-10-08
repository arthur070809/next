import { decodeItemDescription } from "@/lib/requisition-metadata";
import RequisitionDescription from "./RequisitionDescription";

export default function ItemDescription({
  categoria,
  descricao,
  className = "",
  variant = "default",
}: {
  categoria?: string | null;
  descricao?: string | null;
  className?: string;
  variant?: "default" | "checklist";
}) {
  if (variant === "checklist") {
    const cleanDescription = decodeItemDescription(descricao).descricao.trim();
    return (
      <p className={`min-w-0 break-words whitespace-pre-wrap text-sm text-text-secondary [overflow-wrap:anywhere] ${className}`}>
        {cleanDescription || "—"}
      </p>
    );
  }

  return <div className={`min-w-0 break-words whitespace-pre-wrap ${className}`}>
    <p>Categoria: {categoria?.trim() || "—"}</p>
    <div className="min-w-0"><span>Descrição do pedido: </span><RequisitionDescription value={descricao} /></div>
  </div>;
}
