import type { Sentiment, ProblemCategory } from "@/lib/analysis/classify";

export type GoldenCase = {
  id: string;
  rating: number;
  text: string;
  expectedSentiment: Sentiment;
  /** Categoría principal esperada, o null si no se espera ninguna categoría de problema. */
  expectedCategory: ProblemCategory | null;
  /** Solo informativo (no cuenta para el umbral 13/15): se reporta aparte si está definido. */
  expectedMentionsCompensation?: boolean;
  note: string;
};

export const GOLDEN_SET: GoldenCase[] = [
  {
    id: "g1",
    rating: 1,
    text: "Esperamos 50 minutos para que nos tomen el pedido y otros 40 para que llegue la comida. Una vergüenza.",
    expectedSentiment: "negative",
    expectedCategory: "demora",
    note: "queja de demora fuerte",
  },
  {
    id: "g2",
    rating: 3,
    text: "La comida estuvo rica pero tardaron muchísimo en traerla.",
    expectedSentiment: "neutral",
    expectedCategory: "demora",
    note: "mixta: elogio a la comida + queja de demora",
  },
  {
    id: "g3",
    rating: 2,
    text: "El plato llegó frío, tuve que pedir que lo recalienten.",
    expectedSentiment: "negative",
    expectedCategory: "comida_fria",
    note: "queja de comida fría",
  },
  {
    id: "g4",
    rating: 1,
    text: "Pedimos milanesas y llegaron heladas, incomible.",
    expectedSentiment: "negative",
    expectedCategory: "comida_fria",
    note: "queja de comida fría, severa",
  },
  {
    id: "g5",
    rating: 5,
    text: "Excelente comida y atención, todo perfecto.",
    expectedSentiment: "positive",
    expectedCategory: null,
    note: "elogio simple",
  },
  {
    id: "g6",
    rating: 2,
    text: "La pasta estaba pasada y la salsa no tenía gusto a nada, muy decepcionante",
    expectedSentiment: "negative",
    expectedCategory: "calidad_comida",
    note: "queja de calidad de comida",
  },
  {
    id: "g7",
    rating: 1,
    text: "La moza nos ignoró toda la noche, pésima atención.",
    expectedSentiment: "negative",
    expectedCategory: "atencion",
    note: "queja de atención",
  },
  {
    id: "g8",
    rating: 2,
    text: "Pedí una hamburguesa sin cebolla y vino con cebolla, tuve que devolverla.",
    expectedSentiment: "negative",
    expectedCategory: "pedido_incorrecto",
    note: "pedido incorrecto",
  },
  {
    id: "g9",
    rating: 2,
    text: "El baño estaba sucio y las mesas pegajosas.",
    expectedSentiment: "negative",
    expectedCategory: "limpieza",
    note: "queja de limpieza",
  },
  {
    id: "g10",
    rating: 2,
    text: "Muy caro para lo que ofrecen, no vale la pena.",
    expectedSentiment: "negative",
    expectedCategory: "precio",
    note: "queja de precio",
  },
  {
    id: "g11",
    rating: 3,
    text: "La comida buenísima pero el precio es un embole.",
    expectedSentiment: "neutral",
    expectedCategory: "precio",
    note: "mixta: elogio a la comida + queja de precio",
  },
  {
    id: "g12",
    rating: 3,
    text: "Estuvo bien, nada del otro mundo.",
    expectedSentiment: "neutral",
    expectedCategory: null,
    note: "ambigua, sin problema puntual",
  },
  {
    id: "g13",
    rating: 2,
    text: "La música estaba tan fuerte que no podíamos ni hablar, y las mesas re apretadas",
    expectedSentiment: "negative",
    expectedCategory: "ambiente",
    note: "queja de ambiente",
  },
  {
    id: "g14",
    rating: 4,
    text: "Nos tardaron mucho pero como disculpa nos regalaron un postre, buena onda igual.",
    expectedSentiment: "positive",
    expectedCategory: "demora",
    expectedMentionsCompensation: true,
    note: "menciona compensación, tono final positivo pese al problema de demora",
  },
  {
    id: "g15",
    rating: 2,
    text: "",
    expectedSentiment: "negative",
    expectedCategory: null,
    note: "texto vacío: se clasifica solo por rating (regla del Anexo B, sin llamar a la API)",
  },
];
