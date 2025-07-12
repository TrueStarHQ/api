import type {
  AmazonReview,
  GreenFlag,
  RedFlag,
} from '@truestarhq/shared-types';

import { detectReviewBombing } from './review-bombing-detector.js';
import { detectHighVerifiedPurchases } from './verified-purchases-detector.js';

interface FlagAnalysis {
  redFlags: RedFlag[];
  greenFlags: GreenFlag[];
}

/**
 * Runs all local flag detectors on the reviews
 * These are fast, deterministic checks that don't require API calls
 */
export function detectLocalFlags(reviews: AmazonReview[]): FlagAnalysis {
  const redFlags: RedFlag[] = [...detectReviewBombing(reviews)];

  const greenFlags: GreenFlag[] = [...detectHighVerifiedPurchases(reviews)];

  return {
    redFlags,
    greenFlags,
  };
}
