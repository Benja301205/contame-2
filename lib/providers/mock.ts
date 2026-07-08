import type { ReviewProvider, ProviderReview } from "@/lib/providers/reviews";
import { mapApifyReview, type ApifyRawReview } from "@/lib/providers/mapping";
import fixtures from "@/lib/providers/fixtures/reviews.json";

/** Provider de desarrollo/tests: siempre devuelve el mismo set de fixtures. */
export class MockProvider implements ReviewProvider {
  async fetchReviews(_placeId: string, since?: Date): Promise<ProviderReview[]> {
    const reviews = (fixtures as ApifyRawReview[]).map(mapApifyReview);

    if (!since) return reviews;

    return reviews.filter((r) => r.reviewDate && new Date(r.reviewDate) >= since);
  }
}
