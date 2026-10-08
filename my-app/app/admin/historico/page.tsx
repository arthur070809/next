import HistoricoContent from "../../components/HistoricoContent";

export default function AdminHistoricoPage() {
  return (
    <HistoricoContent
      backHref="/admin"
      requisitionHrefBase="/admin/requisicao"
      eyebrow="Administração"
    />
  );
}
