"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_ACCENT } from "@/lib/theme";

export type CategoryBarDatum = { category: string; count: number };

/**
 * Client component: recibe la data ya agregada por el server component
 * padre. El contenedor que lo envuelve NUNCA debe ser `w-fit`: ResponsiveContainer
 * mide el ancho de su padre para `width="100%"`, y `w-fit` sobre un padre sin
 * contenido propio (antes de que el chart mida) colapsa a 0px — el bug real
 * de la card "Distribución de sentimiento" en el dashboard.
 */
export function CategoryBarChart({ data }: { data: CategoryBarDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 32)}>
      <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
        <XAxis type="number" fontSize={12} allowDecimals={false} />
        <YAxis type="category" dataKey="category" fontSize={12} width={110} />
        <Tooltip />
        <Bar dataKey="count" fill={CHART_ACCENT} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
