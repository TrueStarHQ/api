import type { GreenFlag, RedFlag } from '@truestarhq/shared-types';
import { describe, expect, it } from 'vitest';

import { calculateTrustScore } from './trust-score-calculator.js';

describe('calculateTrustScore', () => {
  it('returns base score of 50 with no flags', () => {
    const score = calculateTrustScore({ redFlags: [], greenFlags: [] });
    expect(score).toBe(50);
  });

  it('decreases score for red flags based on confidence', () => {
    const redFlags: RedFlag[] = [
      {
        type: 'review_bombing',
        confidence: 0.8,
        details: {
          date: '2024-01-15',
          reviewCount: 10,
          hoursSpan: 2,
          reviewIds: ['r1', 'r2'],
        },
      },
    ];

    const score = calculateTrustScore({ redFlags, greenFlags: [] });
    expect(score).toBeLessThan(50);
  });

  it('increases score for green flags based on confidence', () => {
    const greenFlags: GreenFlag[] = [
      {
        type: 'high_verified_purchases',
        confidence: 0.9,
        details: {
          percentage: 85,
        },
      },
    ];

    const score = calculateTrustScore({ redFlags: [], greenFlags });
    expect(score).toBeGreaterThan(50);
  });

  it('applies different weights to different flag types', () => {
    // Review bombing should have high impact
    const reviewBombingScore = calculateTrustScore({
      redFlags: [
        {
          type: 'review_bombing',
          confidence: 0.8,
          details: {
            date: '2024-01-15',
            reviewCount: 10,
            hoursSpan: 2,
            reviewIds: ['r1'],
          },
        },
      ],
      greenFlags: [],
    });

    // Phrase repetition should have medium impact
    const phraseRepetitionScore = calculateTrustScore({
      redFlags: [
        {
          type: 'phrase_repetition',
          confidence: 0.8,
          details: {
            phrase: 'test',
            reviewIds: ['r1'],
          },
        },
      ],
      greenFlags: [],
    });

    expect(reviewBombingScore).toBeLessThan(phraseRepetitionScore);
  });

  it('combines multiple flags with diminishing returns', () => {
    const multipleRedFlags: RedFlag[] = [
      {
        type: 'review_bombing',
        confidence: 0.8,
        details: {
          date: '2024-01-15',
          reviewCount: 10,
          hoursSpan: 2,
          reviewIds: ['r1'],
        },
      },
      {
        type: 'phrase_repetition',
        confidence: 0.7,
        details: {
          phrase: 'amazing',
          reviewIds: ['r2', 'r3'],
        },
      },
      {
        type: 'excessive_positivity',
        confidence: 0.6,
        details: {
          reviewIds: ['r4', 'r5'],
          averageRating: 5,
        },
      },
    ];

    const score = calculateTrustScore({
      redFlags: multipleRedFlags,
      greenFlags: [],
    });
    expect(score).toBeLessThan(20); // Multiple red flags should significantly lower score
  });

  it('balances red and green flags', () => {
    const redFlags: RedFlag[] = [
      {
        type: 'excessive_positivity',
        confidence: 0.7,
        details: {
          reviewIds: ['r1', 'r2'],
          averageRating: 5,
        },
      },
    ];

    const greenFlags: GreenFlag[] = [
      {
        type: 'high_verified_purchases',
        confidence: 0.8,
        details: {
          percentage: 90,
        },
      },
    ];

    const score = calculateTrustScore({ redFlags, greenFlags });
    expect(score).toBeGreaterThan(50); // Green flags should outweigh single red flag
    expect(score).toBeLessThan(80); // But not completely negate it
  });

  it('clamps score between 0 and 100', () => {
    // Many severe red flags
    const manyRedFlags: RedFlag[] = Array(10).fill({
      type: 'review_bombing',
      confidence: 1.0,
      details: {
        date: '2024-01-15',
        reviewCount: 50,
        hoursSpan: 1,
        reviewIds: ['r1'],
      },
    });

    const lowScore = calculateTrustScore({
      redFlags: manyRedFlags,
      greenFlags: [],
    });
    expect(lowScore).toBe(0);

    // Many strong green flags
    const manyGreenFlags: GreenFlag[] = Array(10).fill({
      type: 'high_verified_purchases',
      confidence: 1.0,
      details: {
        percentage: 100,
      },
    });

    const highScore = calculateTrustScore({
      redFlags: [],
      greenFlags: manyGreenFlags,
    });
    expect(highScore).toBe(100);
  });
});
