import { todayInBuenosAires } from "@/lib/checkins/today";

export type Period = 30 | 90 | 180;

export function parsePeriod(value: string | undefined): Period {
  if (value === "30" || value === "180") return Number(value) as Period;
  return 90;
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type PeriodWindows = {
  currentStart: string;
  currentEnd: string;
  previousStart: string;
  previousEnd: string;
};

/**
 * Ventanas [start, end) para el período actual (incluye hoy) y el período
 * anterior de igual longitud, usadas para calcular tendencias.
 */
export function getPeriodWindows(period: Period, today: string = todayInBuenosAires()): PeriodWindows {
  const currentEnd = shiftDate(today, 1);
  const currentStart = shiftDate(today, 1 - period);
  const previousEnd = currentStart;
  const previousStart = shiftDate(currentStart, -period);
  return { currentStart, currentEnd, previousStart, previousEnd };
}
