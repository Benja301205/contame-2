import { describe, expect, it } from "vitest";
import { branchVerdict } from "@/lib/dashboard/verdict";
import type { TopCategory } from "@/lib/dashboard/transform";

function makeTop(overrides: Partial<TopCategory>): TopCategory {
  return {
    branchId: "b1",
    category: "atencion",
    currentCount: 10,
    previousCount: 5,
    trend: "up",
    ...overrides,
  };
}

describe("branchVerdict", () => {
  it("sin problemas destacados cuando no hay top category", () => {
    expect(branchVerdict(undefined)).toBe("Sin problemas destacados en el período.");
  });

  it("empeoró cuando la tendencia es up, con el label traducido (sin slug)", () => {
    const result = branchVerdict(makeTop({ category: "comida_fria", trend: "up" }));
    expect(result).toBe("Comida fría es el problema dominante y empeoró vs. el período anterior.");
    expect(result).not.toContain("_");
  });

  it("mejoró cuando la tendencia es down", () => {
    const result = branchVerdict(makeTop({ category: "atencion", trend: "down" }));
    expect(result).toBe("Atención es el problema dominante, pero mejoró vs. el período anterior.");
  });

  it("estable cuando la tendencia es flat", () => {
    const result = branchVerdict(makeTop({ category: "precio", trend: "flat" }));
    expect(result).toBe("Precio es el problema dominante y se mantiene estable vs. el período anterior.");
  });
});
