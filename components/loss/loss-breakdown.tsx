import { formatMoney } from "@/lib/format";

export type LossBreakdownItem = { label: string; total: number };

export function LossBreakdown({
  byType,
  byReason,
  currency = "ARS",
}: {
  byType: LossBreakdownItem[];
  byReason: LossBreakdownItem[];
  currency?: string;
}) {
  return (
    <div className="grid gap-4 text-sm sm:grid-cols-2">
      <div>
        <p className="mb-1 font-medium">Por tipo de compensación</p>
        {byType.length === 0 && <p className="text-muted-foreground">Sin datos.</p>}
        {byType.map((t) => (
          <p key={t.label}>
            {t.label}: {formatMoney(t.total, currency)}
          </p>
        ))}
      </div>
      <div>
        <p className="mb-1 font-medium">Por problema</p>
        {byReason.length === 0 && <p className="text-muted-foreground">Sin datos.</p>}
        {byReason.map((r) => (
          <p key={r.label}>
            {r.label}: {formatMoney(r.total, currency)}
          </p>
        ))}
      </div>
    </div>
  );
}
