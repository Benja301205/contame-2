import "server-only";
import { ApifyClient } from "apify-client";
import type { ReviewProvider, ProviderReview } from "@/lib/providers/reviews";
import { mapApifyReview, type ApifyRawReview } from "@/lib/providers/mapping";

// compass/google-maps-reviews-scraper — $0.30/1.000 reviews (pay-per-event),
// elegido por costo (~10x más barato que Outscraper) y porque ya se usa la
// misma cuenta de Apify en otro producto de Contame. Ver PROGRESS.md.
const ACTOR_ID = "compass/google-maps-reviews-scraper";

export class ApifyProvider implements ReviewProvider {
  private client: ApifyClient;

  constructor(token = process.env.APIFY_TOKEN) {
    if (!token) {
      throw new Error("Falta APIFY_TOKEN para usar ApifyProvider.");
    }
    this.client = new ApifyClient({ token });
  }

  async fetchReviews(placeId: string, since?: Date): Promise<ProviderReview[]> {
    const run = await this.client.actor(ACTOR_ID).call({
      placeIds: [placeId],
      maxReviews: 200,
      reviewsSort: "newest",
      ...(since && { reviewsStartDate: since.toISOString().slice(0, 10) }),
    });

    const { items } = await this.client.dataset(run.defaultDatasetId).listItems();

    return (items as unknown as ApifyRawReview[]).map(mapApifyReview);
  }
}
