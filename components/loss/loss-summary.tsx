function formatMoney(value: number): string {
  return `$${value.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

/**
 * Pérdida real y estimada SIEMPRE separadas, nunca sumadas (criterio de
 * aceptación 2 del Loop 6) — ni siquiera visualmente contiguas sin rótulo.
 */
export function LossSummary({
  compensationTotal,
  estimatedReviewLoss,
  avgTicketConfigured,
}: {
  compensationTotal: number;
  estimatedReviewLoss: number;
  avgTicketConfigured: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <p className="text-xs text-muted-foreground">Pérdida real (check-ins)</p>
        <p className="text-xl font-semibold">{formatMoney(compensationTotal)}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Pérdida estimada (reviews)</p>
        {avgTicketConfigured ? (
          <p className="text-xl font-semibold">{formatMoney(estimatedReviewLoss)}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Configurá el ticket promedio para ver la estimación.
          </p>
        )}
      </div>
    </div>
  );
}
