"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_ACCENT } from "@/lib/theme";
import { ChartTooltip } from "@/components/charts/chart-tooltip";

export type CategoryBarDatum = { category: string; count: number };

/**
 * Client component: recibe la data ya agregada por el server component
 * padre. El contenedor que lo envuelve NUNCA debe ser `w-fit`: ResponsiveContainer
 * mide el ancho de su padre para `width="100%"`, y `w-fit` sobre un padre sin
 * contenido propio (antes de que el chart mida) colapsa a 0px — el bug real
 * de la card "Distribución de sentimiento" en el dashboard.
 *
 * `colors`: opcional, para casos donde cada categoría tiene un significado
 * semántico fijo (ej. sentimiento positivo/neutral/negativo) — si no se
 * pasa, todas las barras usan el acento de marca (caso general: comparar
 * categorías sin jerarquía de color entre ellas).
 */
export function CategoryBarChart({
  data,
  colors,
}: {
  data: CategoryBarDatum[];
  colors?: Record<string, string>;
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 32)}>
      <BarChart data={data} layout="vertical" margin={{ left: 24, right: 28 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis type="number" fontSize={12} stroke="var(--muted-foreground)" allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="category"
          fontSize={12}
          stroke="var(--muted-foreground)"
          width={110}
        />
        <Tooltip content={ChartTooltip} cursor={{ fill: "var(--muted)" }} />
        <Bar dataKey="count" fill={CHART_ACCENT} radius={[0, 4, 4, 0]}>
          <LabelList
            dataKey="count"
            position="right"
            className="fill-foreground text-xs tabular-nums"
          />
          {colors && data.map((d, i) => <Cell key={i} fill={colors[d.category] ?? CHART_ACCENT} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
