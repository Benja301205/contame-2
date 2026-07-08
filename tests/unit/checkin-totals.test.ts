import { describe, expect, it } from "vitest";
import { calculateCheckinTotal } from "@/lib/checkins/totals";

describe("calculateCheckinTotal", () => {
  it("suma quantity × unitCost de todos los ítems", () => {
    const total = calculateCheckinTotal([
      { quantity: 2, unitCost: 500 },
      { quantity: 1, unitCost: 1200 },
    ]);
    expect(total).toBe(2200);
  });

  it("devuelve 0 sin ítems", () => {
    expect(calculateCheckinTotal([])).toBe(0);
  });

  it("soporta cantidades/costos con decimales", () => {
    expect(calculateCheckinTotal([{ quantity: 3, unitCost: 150.5 }])).toBeCloseTo(451.5);
  });
});
