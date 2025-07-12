import type { GreenFlag, RedFlag } from '@truestarhq/shared-types';

interface FlagWeights {
  review_bombing: number;
  phrase_repetition: number;
  excessive_positivity: number;
  high_verified_purchases: number;
}

// Weights determine how much each flag type affects the trust score
// Higher weight = more impact on score
const FLAG_WEIGHTS: FlagWeights = {
  review_bombing: -25, // High impact - coordinated fake reviews
  phrase_repetition: -15, // Medium impact - template reviews
  excessive_positivity: -10, // Low-medium impact - could be genuine enthusiasm
  high_verified_purchases: 20, // High impact - strong authenticity signal
};

// Diminishing returns factors for multiple flags
const DIMINISHING_FACTOR_RED = 0.8;
const DIMINISHING_FACTOR_GREEN = 0.9;

// Penalty for multiple red flags
const MULTIPLE_RED_FLAGS_THRESHOLD = 2;
const MULTIPLE_RED_FLAGS_PENALTY = 0.8; // 20% additional penalty

export function calculateTrustScore({
  redFlags,
  greenFlags,
}: {
  redFlags: RedFlag[];
  greenFlags: GreenFlag[];
}): number {
  const BASE_SCORE = 50;
  let score = BASE_SCORE;

  const redFlagImpact = redFlags.reduce((total, flag, index) => {
    const weight = FLAG_WEIGHTS[flag.type as keyof FlagWeights] || 0;
    const impact = weight * flag.confidence;

    // Apply diminishing returns for multiple flags of same type
    const diminishingFactor = Math.pow(DIMINISHING_FACTOR_RED, index);

    return total + impact * diminishingFactor;
  }, 0);

  const greenFlagImpact = greenFlags.reduce((total, flag, index) => {
    const weight = FLAG_WEIGHTS[flag.type as keyof FlagWeights] || 0;
    const impact = weight * flag.confidence;

    // Apply diminishing returns for multiple flags of same type
    const diminishingFactor = Math.pow(DIMINISHING_FACTOR_GREEN, index);

    return total + impact * diminishingFactor;
  }, 0);

  score += redFlagImpact + greenFlagImpact;

  if (redFlags.length > MULTIPLE_RED_FLAGS_THRESHOLD) {
    score *= MULTIPLE_RED_FLAGS_PENALTY;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}
