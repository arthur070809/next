type ProductCodeProps = {
  code: string | null | undefined;
};

export default function ProductCode({ code }: ProductCodeProps) {
  const value = code?.trim();

  return (
    <div className="mt-2 inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
      {value
        ? <><span className="font-semibold text-text-secondary">Código</span><span aria-hidden="true" className="text-text-secondary">·</span><span className="min-w-0 break-all font-mono text-base font-semibold text-foreground [overflow-wrap:anywhere]">{value}</span></>
        : <span className="text-text-secondary">Sem código</span>}
    </div>
  );
}
