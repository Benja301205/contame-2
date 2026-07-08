import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";

// Catálogo cerrado de categorías de problemas (sección 8 del PRD). Nunca
// inventar categorías fuera de esta lista — tanto el JSON schema que se le
// pasa al modelo como el parser zod lo hacen cumplir.
export const PROBLEM_CATEGORIES = [
  "demora",
  "atencion",
  "calidad_comida",
  "comida_fria",
  "limpieza",
  "precio",
  "pedido_incorrecto",
  "ambiente",
  "otro",
] as const;

export type ProblemCategory = (typeof PROBLEM_CATEGORIES)[number];
export type Sentiment = "positive" | "neutral" | "negative";

// Versión del prompt/schema de clasificación, guardada junto al model id en
// review_analysis.model para poder distinguir resultados de versiones futuras.
export const PROMPT_VERSION = "classify-v1";
export const CLASSIFIER_MODEL = "claude-haiku-4-5";
export const MAX_BATCH_SIZE = 20;

export type ReviewToClassify = { id: string; rating: number; text: string | null };

export type ClassificationResult = {
  reviewId: string;
  sentiment: Sentiment;
  categories: ProblemCategory[];
  severity: 1 | 2 | 3;
  mentionsCompensation: boolean;
  summary: string;
};

const resultItemSchema = z.object({
  review_id: z.string(),
  sentiment: z.enum(["positive", "neutral", "negative"]),
  categories: z.array(z.enum(PROBLEM_CATEGORIES)),
  severity: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  mentions_compensation: z.boolean(),
  summary: z.string(),
});

/**
 * Anexo B, regla de texto vacío: clasificar solo por rating, sin llamar a la
 * API (1-2 negativo, 3 neutral, 4-5 positivo), categories: [].
 */
export function classifyByRatingOnly(reviewId: string, rating: number): ClassificationResult {
  const sentiment: Sentiment = rating <= 2 ? "negative" : rating === 3 ? "neutral" : "positive";

  return {
    reviewId,
    sentiment,
    categories: [],
    severity: sentiment === "negative" ? 2 : 1,
    mentionsCompensation: false,
    summary: `Reseña sin texto (rating ${rating}/5).`,
  };
}

/** JSON schema para output_config.format (type: json_schema) de la Messages API. */
export function buildJsonSchema() {
  return {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            review_id: { type: "string" },
            sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
            categories: {
              type: "array",
              items: { type: "string", enum: [...PROBLEM_CATEGORIES] },
            },
            severity: { type: "integer", enum: [1, 2, 3] },
            mentions_compensation: { type: "boolean" },
            summary: { type: "string" },
          },
          required: [
            "review_id",
            "sentiment",
            "categories",
            "severity",
            "mentions_compensation",
            "summary",
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["results"],
    additionalProperties: false,
  };
}

export function buildPrompt(reviews: ReviewToClassify[]): string {
  const items = reviews
    .map((r) => `- id: ${r.id}\n  rating: ${r.rating}\n  text: ${JSON.stringify(r.text ?? "")}`)
    .join("\n");

  return [
    "Sos un clasificador de reseñas de restaurantes en español (Argentina).",
    `Catálogo cerrado de categorías de problemas: ${PROBLEM_CATEGORIES.join(", ")}.`,
    "Para cada review devolvé exactamente un resultado con el mismo id.",
    "Reglas:",
    "- sentiment: positive, neutral o negative según el tono general del texto.",
    "- categories: subconjunto del catálogo cerrado; nunca inventes categorías nuevas. Si la review no menciona ningún problema, dejalo vacío.",
    "- severity: 1 (leve), 2 (media), 3 (crítica). Reviews positivas o neutras suelen ser 1.",
    "- mentions_compensation: true solo si el cliente dice haber recibido u obtenido un descuento, devolución o plato/bebida gratis por el problema.",
    "- summary: resumen de una línea en español, máximo 120 caracteres.",
    "",
    "Reviews a clasificar:",
    items,
  ].join("\n");
}

export type ParsedBatch = {
  valid: Map<string, ClassificationResult>;
  invalid: Array<{ reviewId?: string; reason: string }>;
};

/**
 * Parsea + valida (zod, como validación secundaria del JSON schema) la
 * respuesta del modelo. Una entrada individual inválida (categoría fuera de
 * catálogo, campo faltante) NO invalida el resto del lote — se reporta en
 * `invalid` y el resto de `valid` sigue siendo utilizable.
 */
export function parseClassifyResponse(rawText: string): ParsedBatch {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    throw new Error("La respuesta del modelo no es JSON válido.");
  }

  const topLevel = z.object({ results: z.array(z.unknown()) }).safeParse(parsedJson);
  if (!topLevel.success) {
    throw new Error("La respuesta del modelo no tiene la forma esperada (falta 'results').");
  }

  const valid = new Map<string, ClassificationResult>();
  const invalid: Array<{ reviewId?: string; reason: string }> = [];

  for (const rawItem of topLevel.data.results) {
    const parsed = resultItemSchema.safeParse(rawItem);

    if (parsed.success) {
      valid.set(parsed.data.review_id, {
        reviewId: parsed.data.review_id,
        sentiment: parsed.data.sentiment,
        categories: parsed.data.categories,
        severity: parsed.data.severity,
        mentionsCompensation: parsed.data.mentions_compensation,
        summary: parsed.data.summary.slice(0, 120),
      });
    } else {
      const maybeId = (rawItem as { review_id?: unknown } | null)?.review_id;
      invalid.push({
        reviewId: typeof maybeId === "string" ? maybeId : undefined,
        reason: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      });
    }
  }

  return { valid, invalid };
}

export async function classifyBatch(
  client: Anthropic,
  reviews: ReviewToClassify[],
): Promise<ParsedBatch> {
  const response = await client.messages.create({
    model: CLASSIFIER_MODEL,
    max_tokens: 4096,
    messages: [{ role: "user", content: buildPrompt(reviews) }],
    output_config: { format: { type: "json_schema", schema: buildJsonSchema() } },
  } as Anthropic.MessageCreateParamsNonStreaming);

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text",
  );
  if (!textBlock) {
    throw new Error("La respuesta del modelo no tiene contenido de texto.");
  }

  return parseClassifyResponse(textBlock.text);
}
