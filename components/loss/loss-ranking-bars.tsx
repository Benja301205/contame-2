import Link from "next/link";
import { formatMoney } from "@/lib/format";

export type LossRankingItem = {
  branchId: string;
  branchName: string;
  compensationTotal: number;
  estimatedReviewLoss: number;
};

/** Sucursales ordenadas de mayor a menor pérdida (ya vienen ordenadas del caller), con barra comparativa. */
export function LossRankingBars({ items, currency }: { items: LossRankingItem[]; currency: string }) {
  const totals = items.map((i) => i.compensationTotal + i.estimatedReviewLoss);
  const max = Math.max(1, ...totals);

  return (
    <div className="space-y-1">
      {items.map((item, i) => {
        const total = totals[i];
        return (
          <Link
            key={item.branchId}
            href={`/branches/${item.branchId}`}
            data-testid={`loss-row-${item.branchId}`}
            className="group -mx-2 block rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-muted/60"
          >
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium group-hover:underline">{item.branchName}</span>
              <span className="font-semibold tabular-nums">{formatMoney(total, currency)}</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary"
                style={{ width: `${Math.max(4, (total / max) * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Registradas por encargados: {formatMoney(item.compensationTotal, currency)} · Estimada por
              reseñas: {formatMoney(item.estimatedReviewLoss, currency)}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
