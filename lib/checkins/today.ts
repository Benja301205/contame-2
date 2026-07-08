const TIME_ZONE = "America/Argentina/Buenos_Aires";

/**
 * Único punto de la app que decide "qué día es" para check-ins. Postgres
 * corre en UTC; usar current_date directamente haría que el día cambiara a
 * las 21:00 hora argentina (UTC-3), bloqueando la edición del check-in de
 * "hoy" tres horas antes de medianoche real. Todo el código de la app y las
 * policies de RLS (checkin_today() en SQL) calculan "hoy" en este huso.
 */
export function toBuenosAiresDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function todayInBuenosAires(now: Date = new Date()): string {
  return toBuenosAiresDateString(now);
}
