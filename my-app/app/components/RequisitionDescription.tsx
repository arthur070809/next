import { decodeItemDescription } from "@/lib/requisition-metadata";

export default function RequisitionDescription({
  value,
  className = "",
  variant = "default",
  priority = false,
}: {
  value?: string | null;
  className?: string;
  variant?: "default" | "queue";
  priority?: boolean;
}) {
  const description = decodeItemDescription(value).descricao.trim();
  if (variant === "queue") {
    const accessibleDescription = description || "Sem descrição";
    return <div
      title={description || undefined}
      aria-label={`Descrição: ${accessibleDescription}`}
      className={`min-w-0 rounded-md px-2 py-1.5 text-sm leading-5 ${
        description
          ? priority
            ? "border-l-2 border-amber-600 bg-amber-50 text-slate-900"
            : "border-l-2 border-slate-300 bg-slate-50 text-slate-900"
          : "border-l-2 border-slate-200 bg-slate-50 text-slate-500"
      } ${className}`}
    >
      <span className="block font-semibold">Descrição</span>
      <span className="line-clamp-2 block break-words [overflow-wrap:anywhere]">{accessibleDescription}</span>
    </div>;
  }
  return <span className={`block min-w-0 [overflow-wrap:anywhere] whitespace-pre-wrap text-slate-500 ${className}`}>
    {description || "Sem descrição"}
  </span>;
}
