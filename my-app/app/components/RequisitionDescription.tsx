import { decodeItemDescription } from "@/lib/requisition-metadata";

export default function RequisitionDescription({
  value,
  className = "",
  variant = "default",
}: {
  value?: string | null;
  className?: string;
  variant?: "default" | "queue";
}) {
  const description = decodeItemDescription(value).descricao.trim();
  if (variant === "queue") {
    return <div
      title={description || undefined}
      aria-label={description ? `Descrição: ${description}` : "Descrição não informada"}
      className={`line-clamp-2 min-w-0 break-words [overflow-wrap:anywhere] text-sm leading-5 ${
        description ? "text-foreground" : "text-text-secondary"
      } ${className}`}
    >
      {description || "—"}
    </div>;
  }
  return <span className={`block min-w-0 [overflow-wrap:anywhere] whitespace-pre-wrap text-text-secondary ${className}`}>
    {description || "Sem descrição"}
  </span>;
}
