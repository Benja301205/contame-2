import type { ProblemCategory, Sentiment } from "@/lib/analysis/classify";

/**
 * Único diccionario de traducción de slugs internos a texto para no-técnicos.
 * Ningún slug con guión bajo debería llegar a la UI — todo pasa por acá.
 */
export const CATEGORY_LABELS: Record<ProblemCategory, string> = {
  demora: "Demora",
  atencion: "Atención",
  calidad_comida: "Calidad de la comida",
  comida_fria: "Comida fría",
  limpieza: "Limpieza",
  precio: "Precio",
  pedido_incorrecto: "Pedido incorrecto",
  ambiente: "Ambiente",
  otro: "Otro",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category as ProblemCategory] ?? category;
}

export type Severity = 1 | 2 | 3;

export const SEVERITY_LABELS: Record<Severity, string> = {
  1: "Menor",
  2: "Importante",
  3: "Grave",
};

/** Semáforo: verde/ámbar/rojo, coherente con el acento de marca del resto de la UI. */
export const SEVERITY_DOT_CLASS: Record<Severity, string> = {
  1: "bg-emerald-500",
  2: "bg-amber-500",
  3: "bg-red-500",
};

export function severityLabel(severity: number): string {
  return SEVERITY_LABELS[severity as Severity] ?? `Severidad ${severity}`;
}

export const SENTIMENT_LABELS: Record<Sentiment, string> = {
  positive: "Positiva",
  neutral: "Neutral",
  negative: "Negativa",
};

export function sentimentLabel(sentiment: string): string {
  return SENTIMENT_LABELS[sentiment as Sentiment] ?? sentiment;
}
