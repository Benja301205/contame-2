import { formatMoney } from "@/lib/format";

/**
 * Número héroe del pitch: la plata primero. Es la única pantalla donde se
 * suma pérdida real + estimada (decisión explícita del dueño del producto,
 * Loop 8) — siempre con el desglose de cada una visible debajo, nunca solo
 * el total a secas.
 */
export function LossHero({
  totalReal,
  totalEstimated,
  currency,
}: {
  totalReal: number;
  totalEstimated: number;
  currency: string;
}) {
  const total = totalReal + totalEstimated;

  return (
    <div className="space-y-2">
      <p className="text-sm text-balance text-muted-foreground">Este mes tu cadena perdió</p>
      <p className="text-display font-bold tabular-nums text-primary">{formatMoney(total, currency)}</p>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span className="text-pretty text-muted-foreground">
          Pérdidas registradas por tus encargados:{" "}
          <strong className="font-semibold tabular-nums text-foreground">
            {formatMoney(totalReal, currency)}
          </strong>
        </span>
        <span className="text-pretty text-muted-foreground">
          Pérdida estimada por reseñas negativas:{" "}
          <strong className="font-semibold tabular-nums text-foreground">
            {formatMoney(totalEstimated, currency)}
          </strong>
        </span>
      </div>
    </div>
  );
}
