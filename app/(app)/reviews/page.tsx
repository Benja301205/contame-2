import { createClient } from "@/lib/supabase/server";
import { ReviewCard, type ReviewCardData } from "@/components/review-card";
import { PROBLEM_CATEGORIES } from "@/lib/analysis/classify";

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{
    branchId?: string;
    rating?: string;
    from?: string;
    to?: string;
    sentiment?: string;
    category?: string;
    severity?: string;
  }>;
}) {
  const { branchId, rating, from, to, sentiment, category, severity } = await searchParams;
  const supabase = await createClient();

  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .order("name");

  const needsAnalysisJoin = Boolean(sentiment || category || severity);
  const analysisRelation = needsAnalysisJoin
    ? "review_analysis!inner(sentiment, categories, severity, mentions_compensation, summary)"
    : "review_analysis(sentiment, categories, severity, mentions_compensation, summary)";

  let query = supabase
    .from("reviews")
    .select(`id, author_name, rating, text, review_date, analysis_status, branches(name), ${analysisRelation}`)
    .order("review_date", { ascending: false });

  if (branchId) query = query.eq("branch_id", branchId);
  if (rating) query = query.eq("rating", Number(rating));
  if (from) query = query.gte("review_date", from);
  if (to) query = query.lte("review_date", to);
  if (sentiment) query = query.eq("review_analysis.sentiment", sentiment);
  if (category) query = query.contains("review_analysis.categories", [category]);
  if (severity) query = query.eq("review_analysis.severity", Number(severity));

  const { data: reviews } = await query;

  const cards: ReviewCardData[] = (reviews ?? []).map((review) => {
    const branchList = Array.isArray(review.branches) ? review.branches : [review.branches];
    const analysisList = Array.isArray(review.review_analysis)
      ? review.review_analysis
      : [review.review_analysis];
    const analysis = analysisList[0] ?? null;

    return {
      id: review.id,
      authorName: review.author_name,
      rating: review.rating,
      text: review.text,
      reviewDate: review.review_date,
      branchName: branchList[0]?.name,
      analysisStatus: review.analysis_status as "pending" | "done" | "failed",
      analysis: analysis
        ? {
            sentiment: analysis.sentiment,
            categories: analysis.categories,
            severity: analysis.severity,
            mentionsCompensation: analysis.mentions_compensation,
            summary: analysis.summary,
          }
        : null,
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Reviews</h1>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <div className="space-y-1">
          <label htmlFor="branchId" className="text-sm font-medium">
            Sucursal
          </label>
          <select
            id="branchId"
            name="branchId"
            defaultValue={branchId ?? ""}
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="">Todas</option>
            {(branches ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="rating" className="text-sm font-medium">
            Rating
          </label>
          <select
            id="rating"
            name="rating"
            defaultValue={rating ?? ""}
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="">Todos</option>
            {[5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={r}>
                {r} estrellas
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="sentiment" className="text-sm font-medium">
            Sentimiento
          </label>
          <select
            id="sentiment"
            name="sentiment"
            defaultValue={sentiment ?? ""}
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="">Todos</option>
            <option value="positive">Positiva</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negativa</option>
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="category" className="text-sm font-medium">
            Categoría
          </label>
          <select
            id="category"
            name="category"
            defaultValue={category ?? ""}
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="">Todas</option>
            {PROBLEM_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="severity" className="text-sm font-medium">
            Severidad
          </label>
          <select
            id="severity"
            name="severity"
            defaultValue={severity ?? ""}
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="">Todas</option>
            {[1, 2, 3].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="from" className="text-sm font-medium">
            Desde
          </label>
          <input
            id="from"
            type="date"
            name="from"
            defaultValue={from ?? ""}
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="to" className="text-sm font-medium">
            Hasta
          </label>
          <input
            id="to"
            type="date"
            name="to"
            defaultValue={to ?? ""}
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
          />
        </div>
        <button type="submit" className="h-9 rounded-md border px-3 text-sm hover:bg-accent">
          Filtrar
        </button>
      </form>

      <div className="space-y-3">
        {cards.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay reviews para estos filtros.</p>
        )}
        {cards.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>
    </div>
  );
}
