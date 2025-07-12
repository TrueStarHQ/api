import type { AmazonReview, ReviewBombingFlag } from '@truestarhq/shared-types';

const MINIMUM_REVIEWS_FOR_BOMBING = 4;

export function detectReviewBombing(
  reviews: AmazonReview[]
): ReviewBombingFlag[] {
  const flags: ReviewBombingFlag[] = [];

  const reviewsByDate = new Map<string, AmazonReview[]>();

  for (const review of reviews) {
    if (!review.date) continue;

    const existing = reviewsByDate.get(review.date) || [];
    existing.push(review);
    reviewsByDate.set(review.date, existing);
  }

  for (const [date, dateReviews] of reviewsByDate) {
    if (dateReviews.length >= MINIMUM_REVIEWS_FOR_BOMBING) {
      const flag: ReviewBombingFlag = {
        type: 'review_bombing',
        confidence: calculateConfidence(dateReviews),
        details: {
          date,
          reviewCount: dateReviews.length,
          hoursSpan: 24, // Simplified - assuming all on same day means within 24 hours
          reviewIds: dateReviews.map((r) => r.id),
        },
      };

      flags.push(flag);
    }
  }

  return flags;
}

function calculateConfidence(reviews: AmazonReview[]): number {
  let confidence = 0.5; // Base confidence

  if (reviews.length >= 10) confidence += 0.2;
  else if (reviews.length >= 5) confidence += 0.1;

  const unverifiedCount = reviews.filter((r) => !r.verified).length;
  const unverifiedRatio = unverifiedCount / reviews.length;
  if (unverifiedRatio > 0.7) confidence += 0.2;
  else if (unverifiedRatio > 0.5) confidence += 0.1;

  const firstRating = reviews[0]?.rating;
  const allSameRating =
    firstRating !== undefined && reviews.every((r) => r.rating === firstRating);
  if (allSameRating) confidence += 0.1;

  return Math.min(confidence, 1.0);
}
