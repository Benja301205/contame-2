"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type CategoryBarDatum = { category: string; count: number };

/** Client component: recibe la data ya agregada por el server component padre. */
export function CategoryBarChart({ data }: { data: CategoryBarDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 32)}>
      <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
        <XAxis type="number" fontSize={12} allowDecimals={false} />
        <YAxis type="category" dataKey="category" fontSize={12} width={110} />
        <Tooltip />
        <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
