import type { AmazonReview } from '@truestarhq/shared-types';
import { describe, expect, it } from 'vitest';

import { detectReviewBombing } from './review-bombing-detector.js';

describe('detectReviewBombing', () => {
  it('detects when multiple reviews are posted within a short time window', () => {
    const reviews: AmazonReview[] = [
      {
        id: 'review-1',
        rating: 5,
        text: 'Amazing product!',
        author: 'User1',
        verified: true,
        date: '2024-01-15',
      },
      {
        id: 'review-2',
        rating: 5,
        text: 'Best thing ever!',
        author: 'User2',
        verified: false,
        date: '2024-01-15',
      },
      {
        id: 'review-3',
        rating: 5,
        text: 'Incredible!',
        author: 'User3',
        verified: false,
        date: '2024-01-15',
      },
      {
        id: 'review-4',
        rating: 5,
        text: 'Love it!',
        author: 'User4',
        verified: false,
        date: '2024-01-15',
      },
      {
        id: 'review-5',
        rating: 5,
        text: 'Perfect!',
        author: 'User5',
        verified: false,
        date: '2024-01-15',
      },
    ];

    const flags = detectReviewBombing(reviews);

    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({
      type: 'review_bombing',
      confidence: expect.any(Number),
      details: {
        date: '2024-01-15',
        reviewCount: 5,
        reviewIds: ['review-1', 'review-2', 'review-3', 'review-4', 'review-5'],
      },
    });
    expect(flags[0].confidence).toBeGreaterThan(0.7);
  });

  it('does not flag reviews spread across different dates', () => {
    const reviews: AmazonReview[] = [
      {
        id: 'review-1',
        rating: 5,
        text: 'Great!',
        author: 'User1',
        verified: true,
        date: '2024-01-10',
      },
      {
        id: 'review-2',
        rating: 4,
        text: 'Good product',
        author: 'User2',
        verified: true,
        date: '2024-01-15',
      },
      {
        id: 'review-3',
        rating: 5,
        text: 'Excellent',
        author: 'User3',
        verified: true,
        date: '2024-01-20',
      },
    ];

    const flags = detectReviewBombing(reviews);

    expect(flags).toHaveLength(0);
  });

  it('requires minimum threshold of reviews on same date to flag', () => {
    const reviews: AmazonReview[] = [
      {
        id: 'review-1',
        rating: 5,
        text: 'Nice',
        author: 'User1',
        verified: true,
        date: '2024-01-15',
      },
      {
        id: 'review-2',
        rating: 4,
        text: 'Good',
        author: 'User2',
        verified: true,
        date: '2024-01-15',
      },
    ];

    const flags = detectReviewBombing(reviews);

    expect(flags).toHaveLength(0);
  });

  it('handles reviews without dates gracefully', () => {
    const reviews: AmazonReview[] = [
      {
        id: 'review-1',
        rating: 5,
        text: 'Great!',
        author: 'User1',
        verified: true,
        // no date
      },
      {
        id: 'review-2',
        rating: 5,
        text: 'Amazing!',
        author: 'User2',
        verified: true,
        date: '2024-01-15',
      },
    ];

    const flags = detectReviewBombing(reviews);

    expect(flags).toHaveLength(0);
  });
});
