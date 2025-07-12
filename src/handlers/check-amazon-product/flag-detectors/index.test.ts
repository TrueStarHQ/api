import type { AmazonReview } from '@truestarhq/shared-types';
import { describe, expect, it } from 'vitest';

import { detectLocalFlags } from './index.js';

describe('detectLocalFlags', () => {
  it('aggregates flags from all local detectors', () => {
    const reviews: AmazonReview[] = [
      // Reviews that trigger review bombing
      {
        id: 'r1',
        rating: 5,
        text: 'Great!',
        author: 'User1',
        verified: false,
        date: '2024-01-15',
      },
      {
        id: 'r2',
        rating: 5,
        text: 'Amazing!',
        author: 'User2',
        verified: false,
        date: '2024-01-15',
      },
      {
        id: 'r3',
        rating: 5,
        text: 'Perfect!',
        author: 'User3',
        verified: false,
        date: '2024-01-15',
      },
      {
        id: 'r4',
        rating: 5,
        text: 'Love it!',
        author: 'User4',
        verified: false,
        date: '2024-01-15',
      },
      // Mixed reviews for green flags
      {
        id: 'r5',
        rating: 3,
        text: 'Okay product',
        author: 'User5',
        verified: true,
        date: '2024-01-20',
      },
      {
        id: 'r6',
        rating: 2,
        text: 'Not great',
        author: 'User6',
        verified: true,
        date: '2024-01-21',
      },
    ];

    const result = detectLocalFlags(reviews);

    // Should have review bombing red flag
    expect(result.redFlags).toHaveLength(1);
    expect(result.redFlags[0].type).toBe('review_bombing');

    // Should not have high verified purchases (only 33% verified)
    expect(result.greenFlags).toEqual([]);
  });

  it('returns empty arrays when no flags detected', () => {
    const reviews: AmazonReview[] = [
      {
        id: 'r1',
        rating: 4,
        text: 'Good product',
        author: 'User1',
        verified: true,
        date: '2024-01-10',
      },
      {
        id: 'r2',
        rating: 5,
        text: 'Excellent!',
        author: 'User2',
        verified: true,
        date: '2024-01-15',
      },
      {
        id: 'r3',
        rating: 3,
        text: 'Average',
        author: 'User3',
        verified: true,
        date: '2024-01-20',
      },
    ];

    const result = detectLocalFlags(reviews);

    expect(result.redFlags).toEqual([]);
    // Should have high verified purchases (100% verified)
    expect(result.greenFlags).toHaveLength(1);
    expect(result.greenFlags[0].type).toBe('high_verified_purchases');
  });
});
