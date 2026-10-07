type ProductCodeProps = {
  code: string | null | undefined;
};

export default function ProductCode({ code }: ProductCodeProps) {
  const value = code?.trim();

  return (
    <div className="mt-2 min-w-0 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2">
      <span className="block text-sm font-semibold text-slate-700">Código</span>
      {value
        ? <span className="block min-w-0 break-all font-mono text-base font-semibold text-slate-950 [overflow-wrap:anywhere]">{value}</span>
        : <span className="block text-sm text-slate-600">Sem código</span>}
    </div>
  );
}
