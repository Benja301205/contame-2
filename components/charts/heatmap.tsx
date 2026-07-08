import { categoryLabel } from "@/lib/labels";

/**
 * Escala de un solo tono (guía de charts.csv para Heatmap/Intensity): más
 * problemas = más intenso. Ámbar en vez del verde de marca a propósito —
 * este chart señala "atención acá", y reservamos el verde para lo positivo.
 */
function colorFor(value: number, max: number): string {
  if (max === 0 || value === 0) return "bg-muted/40";
  const intensity = value / max;
  if (intensity < 0.25) return "bg-amber-100";
  if (intensity < 0.5) return "bg-amber-200";
  if (intensity < 0.75) return "bg-amber-300";
  return "bg-amber-400";
}

export type HeatmapProps = {
  branchNames: string[];
  categories: string[];
  matrix: number[][];
};

/** Grilla estática (sin interactividad), no necesita "use client". */
export function Heatmap({ branchNames, categories, matrix }: HeatmapProps) {
  const max = Math.max(0, ...matrix.flat());

  return (
    <table className="border-separate border-spacing-1 text-xs">
      <thead>
        <tr>
          <th className="p-1 text-left font-medium">Sucursal</th>
          {categories.map((c) => (
            <th key={c} className="p-1 text-center font-normal text-muted-foreground">
              {categoryLabel(c)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {branchNames.map((name, i) => (
          <tr key={name}>
            <td className="p-1 font-medium whitespace-nowrap">{name}</td>
            {(matrix[i] ?? []).map((value, j) => (
              <td
                key={j}
                className={`rounded-md p-1 text-center tabular-nums ${colorFor(value, max)}`}
              >
                {value || ""}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
