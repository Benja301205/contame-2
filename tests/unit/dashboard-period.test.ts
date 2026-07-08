import { describe, expect, it } from "vitest";
import { getPeriodWindows, parsePeriod } from "@/lib/dashboard/period";

describe("parsePeriod", () => {
  it("acepta 30 y 180 explícitos", () => {
    expect(parsePeriod("30")).toBe(30);
    expect(parsePeriod("180")).toBe(180);
  });

  it("default a 90 para cualquier otro valor", () => {
    expect(parsePeriod("90")).toBe(90);
    expect(parsePeriod(undefined)).toBe(90);
    expect(parsePeriod("abc")).toBe(90);
  });
});

describe("getPeriodWindows", () => {
  it("la ventana actual incluye hoy y tiene el largo del período", () => {
    const windows = getPeriodWindows(30, "2026-07-08");
    expect(windows.currentEnd).toBe("2026-07-09");
    expect(windows.currentStart).toBe("2026-06-09");
  });

  it("la ventana anterior es de igual longitud e inmediatamente previa", () => {
    const windows = getPeriodWindows(30, "2026-07-08");
    expect(windows.previousEnd).toBe(windows.currentStart);
    expect(windows.previousStart).toBe("2026-05-10");
  });

  it("funciona con período de 180 días", () => {
    const windows = getPeriodWindows(180, "2026-07-08");
    expect(windows.currentStart).toBe("2026-01-10");
    expect(windows.previousStart).toBe("2025-07-14");
  });
});
