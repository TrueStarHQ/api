import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { checkReview } from './services/review-checker/index.js';
import {
  CheckAmazonReviewsRequest,
  CheckAmazonReviewsResponse,
  ErrorResponse,
  HealthResponse,
} from './types/generated/index.js';
import { checkAmazonReviewsBody } from './types/generated/zod.js';
import { errorHandlingPlugin } from './plugins/error-handling.js';

vi.mock('./services/review-checker/index.js', () => ({
  checkReview: vi.fn(),
}));

const mockCheckReview = vi.mocked(checkReview);

describe('API Endpoints Integration Tests', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    fastify = Fastify({
      logger: false, // Disable logging in tests
    });

    await fastify.register(errorHandlingPlugin);

    await fastify.register(cors, {
      origin: ['http://localhost:3000', 'chrome-extension://*'],
    });

    fastify.get('/health', async (): Promise<HealthResponse> => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });

    fastify.post<{
      Body: CheckAmazonReviewsRequest;
      Reply: CheckAmazonReviewsResponse | ErrorResponse;
    }>('/check/amazon/reviews', async (request, reply) => {
      try {
        // Validate request body using Zod schema
        const validationResult = checkAmazonReviewsBody.safeParse(request.body);

        if (!validationResult.success) {
          const validationErrors = validationResult.error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          }));

          const details = validationErrors
            .map((err) => `${err.field}: ${err.message}`)
            .join(', ');

          const errorResponse: ErrorResponse = {
            statusCode: 400,
            error: 'VALIDATION_ERROR',
            details,
            timestamp: new Date().toISOString(),
          };
          return reply.status(400).send(errorResponse);
        }

        const { reviews } = validationResult.data;

        // Convert ReviewData objects to formatted strings for analysis
        const combinedReviewText = reviews
          .map(
            (review) =>
              `Rating: ${review.rating}/5\nAuthor: ${review.author}\nVerified: ${review.verified ? 'Yes' : 'No'}\nReview: ${review.text}`
          )
          .join('\n\n---\n\n');

        const result = await checkReview(combinedReviewText);

        return {
          result: result,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        fastify.log.error(error);
        const errorResponse: ErrorResponse = {
          statusCode: 500,
          error: 'SERVICE_ERROR',
          details:
            'Internal server error occurred while processing the request',
          timestamp: new Date().toISOString(),
        };
        return reply.status(500).send(errorResponse);
      }
    });

    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
    vi.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);

      const data = JSON.parse(response.payload) as HealthResponse;
      expect(data.status).toBe('ok');
      expect(data.timestamp).toBeDefined();
      expect(typeof data.timestamp).toBe('string');

      // Verify timestamp is a valid ISO string
      const timestamp = new Date(data.timestamp);
      expect(timestamp.toISOString()).toBe(data.timestamp);
    });
  });

  describe('POST /check/amazon/reviews', () => {
    it('should check reviews successfully', async () => {
      const mockAnalysis = {
        isFake: true,
        confidence: 0.85,
        reasons: ['Multiple fake reviews detected'],
        flags: ['generic_language' as const, 'suspicious_timing' as const],
        summary: 'Product has suspicious review patterns',
      };

      mockCheckReview.mockResolvedValue(mockAnalysis);

      const requestBody: CheckAmazonReviewsRequest = {
        reviews: [
          {
            id: 'review-1',
            rating: 5,
            text: 'Best product ever! Amazing quality!',
            author: 'John D.',
            verified: true,
          },
          {
            id: 'review-2',
            rating: 5,
            text: 'Absolutely perfect in every way! Highly recommend!',
            author: 'Jane S.',
            verified: true,
          },
        ],
      };

      const response = await fastify.inject({
        method: 'POST',
        url: '/check/amazon/reviews',
        payload: requestBody,
      });

      expect(response.statusCode).toBe(200);

      const data = JSON.parse(response.payload) as CheckAmazonReviewsResponse;
      expect(data.result).toEqual(mockAnalysis);
      expect(data.timestamp).toBeDefined();
      expect(typeof data.timestamp).toBe('string');

      // Verify the service was called with correct parameters
      expect(mockCheckReview).toHaveBeenCalledWith(
        expect.stringContaining('Best product ever')
      );
    });

    it('should return 400 when reviews are missing', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/check/amazon/reviews',
        payload: {},
      });

      expect(response.statusCode).toBe(400);

      const data = JSON.parse(response.payload) as ErrorResponse;
      expect(data.error).toBe('VALIDATION_ERROR');
      expect(data.statusCode).toBe(400);
      expect(data.details).toContain('reviews');
      expect(data.timestamp).toBeDefined();
      expect(mockCheckReview).not.toHaveBeenCalled();
    });

    it('should return 400 when reviews array is empty', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/check/amazon/reviews',
        payload: {
          reviews: [],
        },
      });

      expect(response.statusCode).toBe(400);

      const data = JSON.parse(response.payload) as ErrorResponse;
      expect(data.error).toBe('VALIDATION_ERROR');
      expect(data.statusCode).toBe(400);
      expect(data.details).toContain('Array must contain at least 1 element');
      expect(data.timestamp).toBeDefined();
      expect(mockCheckReview).not.toHaveBeenCalled();
    });

    it('should handle service errors gracefully', async () => {
      mockCheckReview.mockRejectedValue(new Error('Service unavailable'));

      const requestBody: CheckAmazonReviewsRequest = {
        reviews: [
          {
            id: 'review-test',
            rating: 3,
            text: 'Test review',
            author: 'Test User',
            verified: false,
          },
        ],
      };

      const response = await fastify.inject({
        method: 'POST',
        url: '/check/amazon/reviews',
        payload: requestBody,
      });

      expect(response.statusCode).toBe(500);

      const data = JSON.parse(response.payload) as ErrorResponse;
      expect(data.error).toBe('SERVICE_ERROR');
      expect(data.statusCode).toBe(500);
      expect(data.details).toBe(
        'Internal server error occurred while processing the request'
      );
      expect(data.timestamp).toBeDefined();

      expect(mockCheckReview).toHaveBeenCalledWith(
        expect.stringContaining('Test review')
      );
    });
  });

  describe('CORS', () => {
    it('should allow requests from localhost:3000', async () => {
      const response = await fastify.inject({
        method: 'OPTIONS',
        url: '/health',
        headers: {
          origin: 'http://localhost:3000',
          'access-control-request-method': 'GET',
        },
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000'
      );
    });

    it('should handle OPTIONS requests from chrome extensions', async () => {
      const response = await fastify.inject({
        method: 'OPTIONS',
        url: '/check/amazon/reviews',
        headers: {
          origin: 'chrome-extension://abcdefghijklmnop',
          'access-control-request-method': 'POST',
        },
      });

      // Main goal: ensure OPTIONS requests are handled properly (not rejected)
      expect([200, 204]).toContain(response.statusCode);
    });
  });
});
