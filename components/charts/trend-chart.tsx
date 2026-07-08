"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_ACCENT } from "@/lib/theme";

export type TrendPoint = { label: string; value: number };

/**
 * Recharts es client-only (usa hooks/DOM measurement). Recibe la data ya
 * agregada por el server component que lo renderiza — no hace fetching acá.
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
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" fontSize={12} />
        <YAxis fontSize={12} domain={domain} />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="value"
          name={valueLabel}
          stroke={CHART_ACCENT}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
