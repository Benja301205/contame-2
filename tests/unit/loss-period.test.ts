import { describe, expect, it } from "vitest";
import { currentMonthPeriod, monthsFromTo, nextPeriod, toPeriod } from "@/lib/loss/period";

describe("toPeriod", () => {
  it("normaliza cualquier fecha al primer día de su mes", () => {
    expect(toPeriod("2026-06-15")).toBe("2026-06-01");
    expect(toPeriod("2026-06-01")).toBe("2026-06-01");
  });
});

describe("currentMonthPeriod", () => {
  it("usa el mes de 'hoy' en huso horario argentino", () => {
    expect(currentMonthPeriod("2026-07-08")).toBe("2026-07-01");
  });
});

describe("nextPeriod", () => {
  it("avanza un mes calendario", () => {
    expect(nextPeriod("2026-06-01")).toBe("2026-07-01");
  });

  it("cruza el año en diciembre", () => {
    expect(nextPeriod("2026-12-01")).toBe("2027-01-01");
  });
});

describe("monthsFromTo", () => {
  it("lista todos los meses entre dos períodos, ambos inclusive", () => {
    expect(monthsFromTo("2026-05-01", "2026-08-01")).toEqual([
      "2026-05-01",
      "2026-06-01",
      "2026-07-01",
      "2026-08-01",
    ]);
  });

  it("devuelve un solo mes si first === last", () => {
    expect(monthsFromTo("2026-06-01", "2026-06-01")).toEqual(["2026-06-01"]);
  });

  it("cruza el año", () => {
    expect(monthsFromTo("2026-11-01", "2027-02-01")).toEqual([
      "2026-11-01",
      "2026-12-01",
      "2027-01-01",
      "2027-02-01",
    ]);
  });
});
