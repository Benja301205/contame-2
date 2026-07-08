import { describe, expect, it, vi } from "vitest";

describe("formatMoney", () => {
  it("formatea en es-AR sin decimales y con símbolo de moneda", async () => {
    const { formatMoney } = await import("@/lib/format");
    expect(formatMoney(12400)).toBe(`$ 12.400`);
    expect(formatMoney(0)).toBe(`$ 0`);
  });
});

describe("formatRating", () => {
  it("usa coma decimal y agrega 'de 5'", async () => {
    const { formatRating } = await import("@/lib/format");
    expect(formatRating(2.1)).toBe("2,1 de 5");
    expect(formatRating(4)).toBe("4 de 5");
  });
});

describe("formatHumanDate", () => {
  it("dice 'Hoy, <día de la semana> <día> de <mes>' si la fecha es hoy en hora argentina", async () => {
    vi.resetModules();
    vi.doMock("@/lib/checkins/today", () => ({ todayInBuenosAires: () => "2026-07-08" }));
    const { formatHumanDate } = await import("@/lib/format");
    expect(formatHumanDate("2026-07-08")).toBe("Hoy, miércoles 8 de julio");
    vi.doUnmock("@/lib/checkins/today");
    vi.resetModules();
  });

  it("usa 'D mes AAAA' corto para cualquier otra fecha, sin ISO crudo ni 'de'", async () => {
    const { formatHumanDate } = await import("@/lib/format");
    const result = formatHumanDate("2026-01-05");
    expect(result).toBe("5 ene 2026");
    expect(result).not.toContain("-");
  });
});
