import type { RedFlag } from '@truestarhq/shared-types';
import { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../app.js';

// Mock content pattern analyzer to avoid API calls in tests
vi.mock('./content-pattern-analyzer/index.js', () => ({
  analyzeContentPatterns: vi.fn(() =>
    Promise.resolve({
      redFlags: [],
    })
  ),
}));

import { analyzeContentPatterns } from './content-pattern-analyzer/index.js';

describe('checkAmazonProductHandler', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createApp();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Request validation', () => {
    it('returns 400 when reviews array is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/check/amazon/product',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('reviews');
    });

    it('returns 400 when reviews array is empty', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/check/amazon/product',
        payload: {
          reviews: [],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('at least 1');
    });

    it('returns 400 when reviews exceed maximum', async () => {
      const reviews = Array(101).fill({
        id: 'test',
        rating: 5,
        text: 'Great product',
        author: 'Test User',
        verified: true,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/check/amazon/product',
        payload: { reviews },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('100');
    });

    it('returns 400 when review is missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/check/amazon/product',
        payload: {
          reviews: [
            {
              id: 'test',
              // missing rating, text, author, verified
            },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Response format', () => {
    const validReview = {
      id: 'test-review-1',
      rating: 5,
      text: 'Great product!',
      author: 'Test User',
      verified: true,
    };

    it('returns correct response structure with trust score', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/check/amazon/product',
        payload: {
          reviews: [validReview],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body).toHaveProperty('summary');
      expect(body.summary).toHaveProperty('trustScore');
      expect(typeof body.summary.trustScore).toBe('number');
      expect(body.summary.trustScore).toBeGreaterThanOrEqual(0);
      expect(body.summary.trustScore).toBeLessThanOrEqual(100);

      expect(body).toHaveProperty('metrics');
      expect(body.metrics).toHaveProperty('analyzed');
      expect(body.metrics).toHaveProperty('total');

      expect(body).toHaveProperty('timestamp');
    });

    it('includes green flags when positive indicators found', async () => {
      const reviews = Array(10).fill(validReview);

      const response = await app.inject({
        method: 'POST',
        url: '/check/amazon/product',
        payload: { reviews },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body).toHaveProperty('greenFlags');
      expect(Array.isArray(body.greenFlags)).toBe(true);
    });

    it('detects review bombing and includes in red flags', async () => {
      const bombingReviews = [
        {
          id: 'bomb-1',
          rating: 5,
          text: 'Amazing!',
          author: 'User1',
          verified: false,
          date: '2024-01-15',
        },
        {
          id: 'bomb-2',
          rating: 5,
          text: 'Perfect!',
          author: 'User2',
          verified: false,
          date: '2024-01-15',
        },
        {
          id: 'bomb-3',
          rating: 5,
          text: 'Best ever!',
          author: 'User3',
          verified: false,
          date: '2024-01-15',
        },
        {
          id: 'bomb-4',
          rating: 5,
          text: 'Incredible!',
          author: 'User4',
          verified: false,
          date: '2024-01-15',
        },
        {
          id: 'bomb-5',
          rating: 5,
          text: 'Love it!',
          author: 'User5',
          verified: false,
          date: '2024-01-15',
        },
      ];

      const response = await app.inject({
        method: 'POST',
        url: '/check/amazon/product',
        payload: { reviews: bombingReviews },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body).toHaveProperty('redFlags');
      expect(Array.isArray(body.redFlags)).toBe(true);
      expect(body.redFlags).toHaveLength(1);
      expect(body.redFlags[0]).toMatchObject({
        type: 'review_bombing',
        confidence: expect.any(Number),
        details: {
          date: '2024-01-15',
          reviewCount: 5,
          hoursSpan: expect.any(Number),
          reviewIds: ['bomb-1', 'bomb-2', 'bomb-3', 'bomb-4', 'bomb-5'],
        },
      });
    });

    it('calculates trust score based on flags', async () => {
      // Mock content analyzer to return additional flags
      vi.mocked(analyzeContentPatterns).mockResolvedValueOnce({
        redFlags: [
          {
            type: 'excessive_positivity',
            confidence: 0.7,
            details: {
              reviewIds: ['bomb-1', 'bomb-2'],
              averageRating: 5,
            },
          },
        ],
      });

      const response = await app.inject({
        method: 'POST',
        url: '/check/amazon/product',
        body: {
          reviews: [
            {
              id: 'bomb-1',
              rating: 5,
              text: 'Amazing!',
              author: 'User1',
              verified: false,
              date: '2024-01-15',
            },
            {
              id: 'bomb-2',
              rating: 5,
              text: 'Perfect!',
              author: 'User2',
              verified: false,
              date: '2024-01-15',
            },
            {
              id: 'bomb-3',
              rating: 5,
              text: 'Best ever!',
              author: 'User3',
              verified: false,
              date: '2024-01-15',
            },
            {
              id: 'bomb-4',
              rating: 5,
              text: 'Excellent!',
              author: 'User4',
              verified: false,
              date: '2024-01-15',
            },
          ],
        },
      });

      const body = response.json();

      // With review bombing AND excessive positivity, trust score should be low
      expect(body.summary.trustScore).toBeLessThan(50); // Base score 50 minus penalties

      // Should have review bombing (from local) - excessive_positivity was removed from OpenAI
      expect(body.redFlags).toBeDefined();
      const flagTypes = body.redFlags.map((f: RedFlag) => f.type);
      expect(flagTypes).toContain('review_bombing');
    });

    it('calculates higher trust score with green flags', async () => {
      // Mock content analyzer to return no flags
      vi.mocked(analyzeContentPatterns).mockResolvedValueOnce({
        redFlags: [],
      });

      const response = await app.inject({
        method: 'POST',
        url: '/check/amazon/product',
        body: {
          reviews: [
            {
              id: 'r1',
              rating: 5,
              text: 'Great product',
              author: 'User1',
              verified: true,
            },
            {
              id: 'r2',
              rating: 3,
              text: 'OK but has issues',
              author: 'User2',
              verified: true,
            },
          ],
        },
      });

      const body = response.json();

      // With 100% verified purchases (detected locally) and no red flags, trust score should be high
      // Base 50 + (20 * 0.95) = 50 + 19 = 69
      expect(body.summary.trustScore).toBe(69);
      expect(body.greenFlags).toHaveLength(1);
      expect(body.greenFlags[0].type).toBe('high_verified_purchases');
      expect(body.redFlags).toBeUndefined();
    });
  });
});
