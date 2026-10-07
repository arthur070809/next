import { decodeItemDescription } from "@/lib/requisition-metadata";

export default function RequisitionDescription({
  value,
  className = "",
}: {
  value?: string | null;
  className?: string;
}) {
  const description = decodeItemDescription(value).descricao.trim();
  return <span className={`block min-w-0 [overflow-wrap:anywhere] whitespace-pre-wrap text-slate-500 ${className}`}>
    {description || "Sem descrição"}
  </span>;
}
