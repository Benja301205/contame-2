import { describe, expect, it } from "vitest";
import { todayInBuenosAires, toBuenosAiresDateString } from "@/lib/checkins/today";

describe("todayInBuenosAires", () => {
  it("a las 21:00 hora argentina (00:00 UTC del día siguiente) sigue siendo el día anterior", () => {
    // 2026-07-09T00:30:00Z es 2026-07-08 21:30 en Buenos Aires (UTC-3): un
    // current_date en UTC ya diría "9 de julio" tres horas antes de que en
    // el local sea medianoche real. Este es el escenario exacto del bug.
    const instant = new Date("2026-07-09T00:30:00Z");
    expect(todayInBuenosAires(instant)).toBe("2026-07-08");
  });

  it("justo antes del corte (20:59 ART) todavía es el día anterior en ambos husos", () => {
    const instant = new Date("2026-07-08T23:59:00Z"); // 20:59 ART
    expect(todayInBuenosAires(instant)).toBe("2026-07-08");
  });

  it("después de medianoche real en Buenos Aires (03:00 UTC = 00:00 ART) ya es el día siguiente", () => {
    const instant = new Date("2026-07-09T03:00:00Z"); // 00:00 ART del 9
    expect(todayInBuenosAires(instant)).toBe("2026-07-09");
  });

  it("toBuenosAiresDateString formatea como YYYY-MM-DD", () => {
    expect(toBuenosAiresDateString(new Date("2026-01-05T12:00:00Z"))).toBe("2026-01-05");
  });
});
