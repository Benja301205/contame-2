import { formatMoney } from "@/lib/format";

/**
 * Pérdida real y estimada SIEMPRE separadas, nunca sumadas acá (criterio de
 * aceptación 2 del Loop 6) — ni siquiera visualmente contiguas sin rótulo.
 * (La única pantalla que las suma es el héroe del Panel, con desglose
 * explícito debajo — ver components/loss/loss-hero.tsx, decisión del Loop 8.)
 */
export function LossSummary({
  compensationTotal,
  estimatedReviewLoss,
  avgTicketConfigured,
  currency = "ARS",
}: {
  compensationTotal: number;
  estimatedReviewLoss: number;
  avgTicketConfigured: boolean;
  currency?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <p className="text-xs text-muted-foreground">Pérdidas registradas por tus encargados</p>
        <p className="text-xl font-semibold">{formatMoney(compensationTotal, currency)}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Pérdida estimada por reseñas negativas</p>
        {avgTicketConfigured ? (
          <p className="text-xl font-semibold">{formatMoney(estimatedReviewLoss, currency)}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Configurá el ticket promedio para ver la estimación.
          </p>
        )}
      </div>
    </div>
  );
}
