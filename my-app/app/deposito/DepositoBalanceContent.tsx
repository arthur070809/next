import type { ReactNode } from "react";
import DepositoEmptyState from "./DepositoEmptyState";
import { EmptyState, ErrorState, LoadingState } from "../components/ui";

export default function DepositoBalanceContent({
  loading,
  error,
  empty,
  filtered,
  onAdd,
  onRetry,
  children,
}: {
  loading: boolean;
  error: string;
  empty: boolean;
  filtered: boolean;
  onAdd: () => void;
  onRetry?: () => void;
  children?: ReactNode;
}) {
  if (loading) {
    return <LoadingState label="Carregando saldos do depósito…" rows={4} />;
  }
  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }
  if (empty) return filtered
    ? <EmptyState title="Nenhum saldo encontrado" message="Altere a busca ou os filtros para encontrar materiais." />
    : <DepositoEmptyState filtered={filtered} onAdd={onAdd} />;
  return <div className="divide-y divide-border-subtle">{children}</div>;
}
