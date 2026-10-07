import { decodeItemDescription } from "@/lib/requisition-metadata";

export default function TextoDescricao({
  value,
  className = "",
}: {
  value?: string | null;
  className?: string;
}) {
  return <span className={`break-words whitespace-pre-wrap ${className}`}>
    {decodeItemDescription(value).descricao || "—"}
  </span>;
}
