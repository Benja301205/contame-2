import type { TooltipContentProps } from "recharts";

/** Tooltip con la estética de la UI (card + borde + sombra) en vez del default blanco de Recharts. */
export function ChartTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md">
      {label != null && <p className="mb-0.5 font-medium">{label}</p>}
      {payload.map((entry, i) => (
        <p key={i} className="tabular-nums text-muted-foreground">
          {entry.name ? `${entry.name}: ` : ""}
          <span className="font-medium text-foreground">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}
