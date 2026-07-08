export type ProviderReview = {
  providerReviewId: string;
  authorName: string | null;
  rating: number;
  text: string | null;
  reviewDate: string | null;
};

export interface ReviewProvider {
  fetchReviews(placeId: string, since?: Date): Promise<ProviderReview[]>;
}
