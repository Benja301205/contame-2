import "server-only";
import type { ReviewProvider } from "@/lib/providers/reviews";
import { MockProvider } from "@/lib/providers/mock";
import { ApifyProvider } from "@/lib/providers/apify";

/** REVIEW_PROVIDER=apify usa el actor real de Apify; cualquier otro valor (o ausente) usa el MockProvider. */
export function getReviewProvider(): ReviewProvider {
  if (process.env.REVIEW_PROVIDER === "apify") {
    return new ApifyProvider();
  }
  return new MockProvider();
}
