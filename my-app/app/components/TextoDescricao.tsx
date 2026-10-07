import RequisitionDescription from "./RequisitionDescription";

export default function TextoDescricao({
  value,
  className = "",
}: {
  value?: string | null;
  className?: string;
}) {
  return <RequisitionDescription value={value} className={className} />;
}
