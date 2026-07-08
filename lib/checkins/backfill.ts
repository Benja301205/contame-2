import { todayInBuenosAires } from "@/lib/checkins/today";

/**
 * Días de los últimos `lookbackDays` (sin contar hoy, que maneja el wizard
 * principal) que no tienen check-in registrado. Ordenados de más antiguo a
 * más reciente.
 */
export function getPendingBackfillDays(
  existingDates: string[],
  today: string = todayInBuenosAires(),
  lookbackDays = 7,
): string[] {
  const existing = new Set(existingDates);
  const pending: string[] = [];
  const todayDate = new Date(`${today}T00:00:00Z`);

  for (let i = lookbackDays; i >= 1; i--) {
    const d = new Date(todayDate);
    d.setUTCDate(d.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    if (!existing.has(iso)) pending.push(iso);
  }

  return pending;
}
