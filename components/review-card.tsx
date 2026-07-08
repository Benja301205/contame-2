import { Card, CardContent } from "@/components/ui/card";
import type { ProblemCategory, Sentiment } from "@/lib/analysis/classify";

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} estrellas`}>
      {"★".repeat(rating)}
      {"☆".repeat(5 - rating)}
    </span>
  );
}

const SENTIMENT_LABEL: Record<Sentiment, string> = {
  positive: "Positiva",
  neutral: "Neutral",
  negative: "Negativa",
};

const SENTIMENT_CLASS: Record<Sentiment, string> = {
  positive: "bg-emerald-100 text-emerald-800",
  neutral: "bg-amber-100 text-amber-800",
  negative: "bg-red-100 text-red-800",
};

export type ReviewCardData = {
  id: string;
  authorName: string | null;
  rating: number;
  text: string | null;
  reviewDate: string | null;
  branchName?: string;
  analysisStatus?: "pending" | "done" | "failed";
  analysis: {
    sentiment: Sentiment;
    categories: ProblemCategory[];
    severity: 1 | 2 | 3;
    mentionsCompensation: boolean;
    summary: string | null;
  } | null;
};

export function ReviewCard({ review }: { review: ReviewCardData }) {
  return (
    <Card className="max-w-2xl">
      <CardContent className="space-y-2 py-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{review.authorName ?? "Anónimo"}</span>
          <Stars rating={review.rating} />
        </div>
        <p className="text-xs text-muted-foreground">
          {review.branchName} · {review.reviewDate}
        </p>
        {review.text && <p className="text-sm">{review.text}</p>}

        {review.analysis && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${SENTIMENT_CLASS[review.analysis.sentiment]}`}
            >
              {SENTIMENT_LABEL[review.analysis.sentiment]}
            </span>
            {review.analysis.categories.map((c) => (
              <span key={c} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                {c}
              </span>
            ))}
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
              Severidad {review.analysis.severity}
            </span>
            {review.analysis.mentionsCompensation && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                Menciona compensación
              </span>
            )}
          </div>
        )}
        {!review.analysis && review.analysisStatus === "pending" && (
          <p className="pt-1 text-xs text-muted-foreground">Análisis pendiente.</p>
        )}
        {!review.analysis && review.analysisStatus === "failed" && (
          <p className="pt-1 text-xs text-destructive">
            El análisis falló para esta reseña — se reintentará en la próxima corrida.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
