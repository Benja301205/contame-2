"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_ACCENT } from "@/lib/theme";
import { ChartTooltip } from "@/components/charts/chart-tooltip";

export type TrendPoint = { label: string; value: number };

/**
 * Recharts es client-only (usa hooks/DOM measurement). Recibe la data ya
 * agregada por el server component que lo renderiza — no hace fetching acá.
 * Area chart (no solo línea): guía de charts.csv para "Trend Over Time" —
 * línea + fill de 20% opacity, no es un gradiente decorativo.
 */
export function TrendChart({
  data,
  valueLabel,
  domain,
}: {
  data: TrendPoint[];
  valueLabel: string;
  domain?: [number, number];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis dataKey="label" fontSize={12} stroke="var(--muted-foreground)" />
        <YAxis fontSize={12} stroke="var(--muted-foreground)" domain={domain} />
        <Tooltip content={ChartTooltip} cursor={{ stroke: "var(--border)" }} />
        <Area
          type="monotone"
          dataKey="value"
          name={valueLabel}
          stroke={CHART_ACCENT}
          strokeWidth={2}
          fill={CHART_ACCENT}
          fillOpacity={0.15}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
