import type { AmazonReview } from '@truestarhq/shared-types';
import { describe, expect, it } from 'vitest';

import { detectHighVerifiedPurchases } from './verified-purchases-detector.js';

describe('detectHighVerifiedPurchases', () => {
  it('returns empty array when no reviews provided', () => {
    const result = detectHighVerifiedPurchases([]);
    expect(result).toEqual([]);
  });

  it('returns empty array when verified percentage is below threshold', () => {
    const reviews: AmazonReview[] = [
      { id: 'r1', rating: 5, text: 'Great!', author: 'User1', verified: true },
      { id: 'r2', rating: 5, text: 'Good!', author: 'User2', verified: false },
      { id: 'r3', rating: 5, text: 'Nice!', author: 'User3', verified: false },
      { id: 'r4', rating: 5, text: 'Ok!', author: 'User4', verified: false },
    ];

    const result = detectHighVerifiedPurchases(reviews);
    expect(result).toEqual([]);
  });

  it('detects high verified purchases at exactly 70%', () => {
    const reviews: AmazonReview[] = [
      { id: 'r1', rating: 5, text: 'Great!', author: 'User1', verified: true },
      { id: 'r2', rating: 5, text: 'Good!', author: 'User2', verified: true },
      { id: 'r3', rating: 5, text: 'Nice!', author: 'User3', verified: true },
      { id: 'r4', rating: 5, text: 'Ok!', author: 'User4', verified: true },
      { id: 'r5', rating: 5, text: 'Cool!', author: 'User5', verified: true },
      { id: 'r6', rating: 5, text: 'Wow!', author: 'User6', verified: true },
      { id: 'r7', rating: 5, text: 'Yes!', author: 'User7', verified: true },
      { id: 'r8', rating: 5, text: 'Fine!', author: 'User8', verified: false },
      { id: 'r9', rating: 5, text: 'Meh!', author: 'User9', verified: false },
      { id: 'r10', rating: 5, text: 'Hmm!', author: 'User10', verified: false },
    ];

    const result = detectHighVerifiedPurchases(reviews);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'high_verified_purchases',
      confidence: 0.55,
      details: {
        percentage: 70,
      },
    });
  });

  it('detects high verified purchases with higher confidence at 90%', () => {
    const reviews: AmazonReview[] = [
      { id: 'r1', rating: 5, text: 'Great!', author: 'User1', verified: true },
      { id: 'r2', rating: 5, text: 'Good!', author: 'User2', verified: true },
      { id: 'r3', rating: 5, text: 'Nice!', author: 'User3', verified: true },
      { id: 'r4', rating: 5, text: 'Ok!', author: 'User4', verified: true },
      { id: 'r5', rating: 5, text: 'Cool!', author: 'User5', verified: true },
      { id: 'r6', rating: 5, text: 'Wow!', author: 'User6', verified: true },
      { id: 'r7', rating: 5, text: 'Yes!', author: 'User7', verified: true },
      { id: 'r8', rating: 5, text: 'Fine!', author: 'User8', verified: true },
      { id: 'r9', rating: 5, text: 'Meh!', author: 'User9', verified: true },
      { id: 'r10', rating: 5, text: 'Hmm!', author: 'User10', verified: false },
    ];

    const result = detectHighVerifiedPurchases(reviews);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'high_verified_purchases',
      confidence: 0.95,
      details: {
        percentage: 90,
      },
    });
  });

  it('handles all verified purchases correctly', () => {
    const reviews: AmazonReview[] = [
      { id: 'r1', rating: 5, text: 'Great!', author: 'User1', verified: true },
      { id: 'r2', rating: 4, text: 'Good!', author: 'User2', verified: true },
      { id: 'r3', rating: 3, text: 'Ok!', author: 'User3', verified: true },
    ];

    const result = detectHighVerifiedPurchases(reviews);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'high_verified_purchases',
      confidence: 0.95,
      details: {
        percentage: 100,
      },
    });
  });
});
