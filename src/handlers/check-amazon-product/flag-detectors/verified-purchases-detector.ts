import type {
  AmazonReview,
  HighVerifiedPurchasesFlag,
} from '@truestarhq/shared-types';

const VERIFIED_PURCHASE_THRESHOLD = 70; // 70% or more is considered high

export function detectHighVerifiedPurchases(
  reviews: AmazonReview[]
): HighVerifiedPurchasesFlag[] {
  if (reviews.length === 0) {
    return [];
  }

  const verifiedCount = reviews.filter((review) => review.verified).length;
  const percentage = Math.round((verifiedCount / reviews.length) * 100);

  if (percentage >= VERIFIED_PURCHASE_THRESHOLD) {
    return [
      {
        type: 'high_verified_purchases',
        confidence: calculateConfidence(percentage),
        details: {
          percentage,
        },
      },
    ];
  }

  return [];
}

function calculateConfidence(percentage: number): number {
  if (percentage >= 90) return 0.95;
  if (percentage >= 85) return 0.85;
  if (percentage >= 80) return 0.75;
  if (percentage >= 75) return 0.65;
  return 0.55; // 70-74%
}
