import { todayInBuenosAires } from "@/lib/checkins/today";

/** Plata en formato es-AR: "$ 12.400" (sin decimales, coma decimal si hiciera falta). */
export function formatMoney(value: number, currency = "ARS"): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Rating con coma decimal: "2,1 de 5". */
export function formatRating(value: number): string {
  const formatted = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value);
  return `${formatted} de 5`;
}

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  weekday: "long",
});

const DAY_MONTH_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "numeric",
  month: "long",
});

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const SHORT_DAY_MONTH_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "numeric",
  month: "short",
});

/** "8 jul", sin año — para encabezados de tabla donde el año es obvio por contexto. */
export function formatShortDayMonth(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  return SHORT_DAY_MONTH_FORMATTER.format(date).replace(/\bde\s/g, "");
}

/**
 * Fecha humana para no-técnicos: "Hoy, martes 8 de julio" si es hoy (hora
 * argentina), "8 jul 2026" en cualquier otro caso. Nunca una fecha ISO cruda.
 * Se arma a mano (no con Intl "weekday+day+month" en un solo formatter) porque
 * ese combo inserta una coma después del día de la semana ("miércoles, 8 de
 * julio") en vez de antes ("Hoy, miércoles 8 de julio").
 */
export function formatHumanDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);

  if (isoDate === todayInBuenosAires()) {
    return `Hoy, ${WEEKDAY_FORMATTER.format(date)} ${DAY_MONTH_FORMATTER.format(date)}`;
  }

  return SHORT_DATE_FORMATTER.format(date).replace(/\bde\s/g, "");
}
