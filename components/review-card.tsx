import { Card, CardContent } from "@/components/ui/card";
import type { ProblemCategory, Sentiment } from "@/lib/analysis/classify";
import { categoryLabel, SEVERITY_DOT_CLASS, sentimentLabel, severityLabel } from "@/lib/labels";
import { formatRating } from "@/lib/format";
import { Stars } from "@/components/stars";

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
          <span className="flex items-center gap-1.5">
            <Stars rating={review.rating} />
            <span className="text-xs text-muted-foreground">{formatRating(review.rating)}</span>
          </span>
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
              {sentimentLabel(review.analysis.sentiment)}
            </span>
            {review.analysis.categories.map((c) => (
              <span key={c} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                {categoryLabel(c)}
              </span>
            ))}
            <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
              <span className={`h-1.5 w-1.5 rounded-full ${SEVERITY_DOT_CLASS[review.analysis.severity]}`} />
              {severityLabel(review.analysis.severity)}
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
