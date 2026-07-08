import { describe, expect, it } from "vitest";
import { mapApifyReview } from "@/lib/providers/mapping";

describe("mapApifyReview", () => {
  it("mapea los campos del provider al schema interno", () => {
    const mapped = mapApifyReview({
      reviewId: "abc123",
      name: "Ana López",
      stars: 4,
      text: "Muy bueno",
      publishedAtDate: "2026-05-01T10:00:00.000Z",
      isLocalGuide: true,
      reviewerNumberOfReviews: 10,
      likesCount: 2,
    });

    expect(mapped).toEqual({
      providerReviewId: "abc123",
      authorName: "Ana López",
      rating: 4,
      text: "Muy bueno",
      reviewDate: "2026-05-01",
    });
  });

  it("tolera campos opcionales ausentes", () => {
    const mapped = mapApifyReview({ reviewId: "sin-datos", stars: 3 });

    expect(mapped).toEqual({
      providerReviewId: "sin-datos",
      authorName: null,
      rating: 3,
      text: null,
      reviewDate: null,
    });
  });
});
