import { todayInBuenosAires } from "@/lib/checkins/today";

/** Primer día del mes en curso, en huso horario argentino (mismo criterio que checkins). */
export function currentMonthPeriod(today: string = todayInBuenosAires()): string {
  return toPeriod(today);
}

/** Normaliza cualquier fecha YYYY-MM-DD al primer día de su mes. */
export function toPeriod(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

/** Primer día del mes siguiente a `period`. */
export function nextPeriod(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
}

/** Todos los meses (YYYY-MM-01) entre `firstPeriod` y `lastPeriod`, ambos inclusive, ascendente. */
export function monthsFromTo(firstPeriod: string, lastPeriod: string): string[] {
  const months: string[] = [];
  let cursor = firstPeriod;
  while (cursor <= lastPeriod) {
    months.push(cursor);
    cursor = nextPeriod(cursor);
  }
  return months;
}
