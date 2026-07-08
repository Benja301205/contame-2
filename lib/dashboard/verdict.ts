import type { TopCategory } from "@/lib/dashboard/transform";
import { categoryLabel } from "@/lib/labels";

/**
 * Frase de una línea por sucursal, generada por reglas (sin LLM): traduce el
 * problema dominante y su tendencia a algo que un dueño no técnico entiende
 * de un vistazo, sin tener que leer un chart. Más quejas de esa categoría
 * que en el período anterior = "empeoró" (más quejas es peor, no importa si
 * el conteo en sí "sube").
 */
export function branchVerdict(top: TopCategory | undefined): string {
  if (!top) {
    return "Sin problemas destacados en el período.";
  }

  const label = categoryLabel(top.category);

  if (top.trend === "up") {
    return `${label} es el problema dominante y empeoró vs. el período anterior.`;
  }
  if (top.trend === "down") {
    return `${label} es el problema dominante, pero mejoró vs. el período anterior.`;
  }
  return `${label} es el problema dominante y se mantiene estable vs. el período anterior.`;
}
