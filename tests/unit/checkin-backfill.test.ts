import { describe, expect, it } from "vitest";
import { getPendingBackfillDays } from "@/lib/checkins/backfill";

describe("getPendingBackfillDays", () => {
  const today = "2026-07-08";

  it("devuelve los 7 días previos si no hay ningún check-in cargado", () => {
    const pending = getPendingBackfillDays([], today);
    expect(pending).toEqual([
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
      "2026-07-04",
      "2026-07-05",
      "2026-07-06",
      "2026-07-07",
    ]);
  });

  it("no incluye hoy (lo maneja el wizard principal, no el banner de pendientes)", () => {
    const pending = getPendingBackfillDays([], today);
    expect(pending).not.toContain(today);
  });

  it("excluye los días que ya tienen check-in", () => {
    const pending = getPendingBackfillDays(["2026-07-05", "2026-07-06"], today);
    expect(pending).toEqual(["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-07"]);
  });

  it("devuelve vacío si los últimos 7 días están todos completos", () => {
    const allDays = [
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
      "2026-07-04",
      "2026-07-05",
      "2026-07-06",
      "2026-07-07",
    ];
    expect(getPendingBackfillDays(allDays, today)).toEqual([]);
  });

  it("respeta un lookback distinto de 7", () => {
    const pending = getPendingBackfillDays([], today, 3);
    expect(pending).toEqual(["2026-07-05", "2026-07-06", "2026-07-07"]);
  });
});
