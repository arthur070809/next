import type { ReactNode } from "react";
import DepositoEmptyState from "./DepositoEmptyState";

export default function DepositoBalanceContent({
  loading,
  error,
  empty,
  filtered,
  onAdd,
  children,
}: {
  loading: boolean;
  error: string;
  empty: boolean;
  filtered: boolean;
  onAdd: () => void;
  children?: ReactNode;
}) {
  if (loading) {
    return <p role="status" className="py-10 text-center text-sm text-slate-500">Carregando saldos…</p>;
  }
  if (error) {
    return <p role="alert" className="my-6 rounded-lg border border-red-200 bg-red-50 p-5 text-red-800">{error}</p>;
  }
  if (empty) return <DepositoEmptyState filtered={filtered} onAdd={onAdd} />;
  return <div className="divide-y divide-slate-200">{children}</div>;
}
