import { describe, expect, it } from "vitest";
import {
  buildHeatmap,
  computeTrend,
  ratingTrend,
  topCategoriesForBranch,
  type CategoryStat,
} from "@/lib/dashboard/transform";

describe("computeTrend", () => {
  it("up cuando el actual es mayor", () => {
    expect(computeTrend(10, 5)).toBe("up");
  });
  it("down cuando el actual es menor", () => {
    expect(computeTrend(5, 10)).toBe("down");
  });
  it("flat cuando son iguales", () => {
    expect(computeTrend(5, 5)).toBe("flat");
  });
});

describe("ratingTrend", () => {
  it("calcula el delta y la dirección", () => {
    expect(ratingTrend(4.5, 4.0)).toEqual({ delta: 0.5, direction: "up" });
    expect(ratingTrend(3.8, 4.2)).toEqual({ delta: -0.4, direction: "down" });
  });

  it("devuelve flat/0 si falta algún período", () => {
    expect(ratingTrend(null, 4.0)).toEqual({ delta: 0, direction: "flat" });
    expect(ratingTrend(4.0, null)).toEqual({ delta: 0, direction: "flat" });
  });
});

describe("topCategoriesForBranch", () => {
  const stats: CategoryStat[] = [
    { branchId: "A", category: "demora", currentCount: 20, previousCount: 10 },
    { branchId: "A", category: "atencion", currentCount: 5, previousCount: 8 },
    { branchId: "A", category: "precio", currentCount: 15, previousCount: 15 },
    { branchId: "A", category: "limpieza", currentCount: 3, previousCount: 1 },
    { branchId: "A", category: "ambiente", currentCount: 1, previousCount: 0 },
    { branchId: "A", category: "otro", currentCount: 0, previousCount: 2 },
    { branchId: "B", category: "atencion", currentCount: 30, previousCount: 10 },
  ];

  it("ordena por frecuencia descendente y limita a N", () => {
    const top = topCategoriesForBranch(stats, "A", 3);
    expect(top.map((t) => t.category)).toEqual(["demora", "precio", "atencion"]);
  });

  it("excluye categorías con 0 en el período actual", () => {
    const top = topCategoriesForBranch(stats, "A", 10);
    expect(top.find((t) => t.category === "otro")).toBeUndefined();
  });

  it("incluye la tendencia por categoría", () => {
    const top = topCategoriesForBranch(stats, "A", 10);
    expect(top.find((t) => t.category === "demora")!.trend).toBe("up");
    expect(top.find((t) => t.category === "atencion")!.trend).toBe("down");
    expect(top.find((t) => t.category === "precio")!.trend).toBe("flat");
  });

  it("filtra solo la sucursal pedida", () => {
    const top = topCategoriesForBranch(stats, "B", 5);
    expect(top).toHaveLength(1);
    expect(top[0].category).toBe("atencion");
  });
});

describe("buildHeatmap", () => {
  it("arma una matriz sucursal × categoría con los conteos actuales", () => {
    const stats: CategoryStat[] = [
      { branchId: "A", category: "demora", currentCount: 20, previousCount: 10 },
      { branchId: "B", category: "atencion", currentCount: 30, previousCount: 10 },
    ];
    const matrix = buildHeatmap(stats, ["A", "B"], ["demora", "atencion"]);
    expect(matrix).toEqual([
      [20, 0],
      [0, 30],
    ]);
  });
});
