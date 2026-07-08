export type Trend = "up" | "down" | "flat";

export type CategoryStat = {
  branchId: string;
  category: string;
  currentCount: number;
  previousCount: number;
};

/** Puro: dirección de la tendencia comparando dos números. */
export function computeTrend(current: number, previous: number): Trend {
  if (current > previous) return "up";
  if (current < previous) return "down";
  return "flat";
}

export type RatingTrend = { delta: number; direction: Trend };

/** Puro: delta y dirección de tendencia de rating entre dos períodos. */
export function ratingTrend(currentAvg: number | null, previousAvg: number | null): RatingTrend {
  if (currentAvg === null || previousAvg === null) {
    return { delta: 0, direction: "flat" };
  }
  const delta = Math.round((currentAvg - previousAvg) * 100) / 100;
  return { delta, direction: computeTrend(currentAvg, previousAvg) };
}

export type TopCategory = CategoryStat & { trend: Trend };

/**
 * Top N categorías de una sucursal por frecuencia en el período actual,
 * con la tendencia respecto al período anterior.
 */
export function topCategoriesForBranch(
  stats: CategoryStat[],
  branchId: string,
  limit = 5,
): TopCategory[] {
  return stats
    .filter((s) => s.branchId === branchId && s.currentCount > 0)
    .sort((a, b) => b.currentCount - a.currentCount)
    .slice(0, limit)
    .map((s) => ({ ...s, trend: computeTrend(s.currentCount, s.previousCount) }));
}

/** Puro: matriz sucursal × categoría (filas = branchIds, columnas = categories) con el conteo del período actual. */
export function buildHeatmap(
  stats: CategoryStat[],
  branchIds: string[],
  categories: string[],
): number[][] {
  return branchIds.map((branchId) =>
    categories.map((category) => {
      const found = stats.find((s) => s.branchId === branchId && s.category === category);
      return found?.currentCount ?? 0;
    }),
  );
}
