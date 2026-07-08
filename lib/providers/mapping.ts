import type { ProviderReview } from "@/lib/providers/reviews";

/**
 * Shape (parcial) de un item del dataset del actor de Apify
 * compass/google-maps-reviews-scraper. Solo se listan los campos que
 * mapeamos hoy; isLocalGuide/reviewerNumberOfReviews/likesCount se
 * reciben pero no se persisten todavía (quedan para el motor de pesos
 * de un loop posterior, ver PROGRESS.md).
 */
export type ApifyRawReview = {
  reviewId: string;
  name?: string | null;
  stars: number;
  text?: string | null;
  publishedAtDate?: string | null;
  isLocalGuide?: boolean;
  reviewerNumberOfReviews?: number;
  likesCount?: number;
};

/** Mapeo puro provider (Apify) → schema interno (ProviderReview). */
export function mapApifyReview(raw: ApifyRawReview): ProviderReview {
  return {
    providerReviewId: raw.reviewId,
    authorName: raw.name ?? null,
    rating: raw.stars,
    text: raw.text ?? null,
    reviewDate: raw.publishedAtDate ? raw.publishedAtDate.slice(0, 10) : null,
  };
}
