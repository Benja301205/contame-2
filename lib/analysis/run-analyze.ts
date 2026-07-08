import type { SupabaseClient } from "@supabase/supabase-js";
import type Anthropic from "@anthropic-ai/sdk";
import {
  classifyByRatingOnly,
  classifyBatch,
  CLASSIFIER_MODEL,
  MAX_BATCH_SIZE,
  PROMPT_VERSION,
  type ClassificationResult,
  type ReviewToClassify,
} from "@/lib/analysis/classify";

type ReviewRow = { id: string; rating: number; text: string | null };

export type AnalyzeResult =
  | { reviewId: string; status: "done" }
  | { reviewId: string; status: "failed"; error: string };

const MAX_ATTEMPTS = 2;

async function saveResult(
  admin: SupabaseClient,
  classification: ClassificationResult,
  results: AnalyzeResult[],
) {
  const { error } = await admin.from("review_analysis").upsert(
    {
      review_id: classification.reviewId,
      sentiment: classification.sentiment,
      categories: classification.categories,
      severity: classification.severity,
      mentions_compensation: classification.mentionsCompensation,
      summary: classification.summary,
      model: `${CLASSIFIER_MODEL}:${PROMPT_VERSION}`,
      analyzed_at: new Date().toISOString(),
    },
    { onConflict: "review_id" },
  );

  if (error) {
    await markFailed(admin, classification.reviewId);
    results.push({ reviewId: classification.reviewId, status: "failed", error: error.message });
    return;
  }

  await admin.from("reviews").update({ analysis_status: "done" }).eq("id", classification.reviewId);
  results.push({ reviewId: classification.reviewId, status: "done" });
}

async function markFailed(admin: SupabaseClient, reviewId: string) {
  await admin.from("reviews").update({ analysis_status: "failed" }).eq("id", reviewId);
}

/**
 * Procesa un lote de hasta MAX_BATCH_SIZE reviews con texto. Reintenta la
 * llamada al modelo hasta MAX_ATTEMPTS veces solo si falla por completo
 * (red, JSON malformado). Si la llamada responde pero a un review puntual
 * le falta el resultado o viene con datos inválidos, SOLO esa review se
 * marca failed — el resto del lote (matcheado por review_id, nunca por
 * posición) se guarda igual.
 */
async function processBatch(
  admin: SupabaseClient,
  anthropic: Anthropic,
  batch: ReviewRow[],
  results: AnalyzeResult[],
) {
  const input: ReviewToClassify[] = batch.map((r) => ({ id: r.id, rating: r.rating, text: r.text }));

  let parsed: Awaited<ReturnType<typeof classifyBatch>> | undefined;
  let lastError = "Error desconocido.";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      parsed = await classifyBatch(anthropic, input);
      break;
    } catch (err) {
      lastError = err instanceof Error ? err.message : lastError;
    }
  }

  if (!parsed) {
    for (const review of batch) {
      await markFailed(admin, review.id);
      results.push({ reviewId: review.id, status: "failed", error: lastError });
    }
    return;
  }

  for (const review of batch) {
    const classification = parsed.valid.get(review.id);

    if (classification) {
      await saveResult(admin, classification, results);
      continue;
    }

    const invalidEntry = parsed.invalid.find((i) => i.reviewId === review.id);
    const reason = invalidEntry?.reason ?? "El modelo no devolvió resultado para esta review.";
    await markFailed(admin, review.id);
    results.push({ reviewId: review.id, status: "failed", error: reason });
  }
}

/**
 * Núcleo del job de análisis, sin dependencias de Next, para poder
 * testearlo directo contra Supabase local con un cliente Anthropic
 * mockeado. Nunca reprocesa reviews que ya están en 'done'.
 */
export async function runAnalyzeForPending(
  admin: SupabaseClient,
  anthropic: Anthropic,
  filters: { orgId?: string; branchId?: string; limit?: number },
): Promise<{ status: number; body: { results?: AnalyzeResult[]; error?: string } }> {
  let query = admin
    .from("reviews")
    .select("id, org_id, branch_id, rating, text")
    .eq("analysis_status", "pending")
    .order("fetched_at", { ascending: true })
    .limit(filters.limit ?? 500);

  if (filters.orgId) query = query.eq("org_id", filters.orgId);
  if (filters.branchId) query = query.eq("branch_id", filters.branchId);

  const { data: pending, error } = await query.returns<ReviewRow[]>();

  if (error) {
    return { status: 500, body: { error: error.message } };
  }

  const results: AnalyzeResult[] = [];
  if (!pending || pending.length === 0) {
    return { status: 200, body: { results } };
  }

  const emptyTextReviews = pending.filter((r) => !r.text || r.text.trim() === "");
  const nonEmptyReviews = pending.filter((r) => r.text && r.text.trim() !== "");

  for (const review of emptyTextReviews) {
    const classification = classifyByRatingOnly(review.id, review.rating);
    await saveResult(admin, classification, results);
  }

  for (let i = 0; i < nonEmptyReviews.length; i += MAX_BATCH_SIZE) {
    const batch = nonEmptyReviews.slice(i, i + MAX_BATCH_SIZE);
    await processBatch(admin, anthropic, batch, results);
  }

  return { status: 200, body: { results } };
}
