import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { checkReview } from './services/review-checker/index.js';
import {
  CheckAmazonReviewsRequest,
  CheckAmazonReviewsResponse,
  ErrorResponse,
  ValidationErrorResponse,
  ServiceErrorResponse,
  HealthResponse,
} from './types/generated/index.js';
import { checkAmazonReviewsBody } from './types/generated/zod.js';

// Mock the review checker service
vi.mock('./services/review-checker/index.js', () => ({
  checkReview: vi.fn(),
}));

const mockCheckReview = vi.mocked(checkReview);

describe('API Endpoints Integration Tests', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    // Create a new Fastify instance for each test
    fastify = Fastify({
      logger: false, // Disable logging in tests
    });

    // Register CORS plugin
    await fastify.register(cors, {
      origin: ['http://localhost:3000', 'chrome-extension://*'],
    });

    // Health check endpoint
    fastify.get('/health', async (): Promise<HealthResponse> => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // Amazon review checking endpoint
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

          return reply.status(400).send({
            error: 'VALIDATION_ERROR',
            details,
            validationErrors,
            timestamp: new Date().toISOString(),
          });
        }

        const { reviews } = validationResult.data;

        // Convert ReviewData objects to formatted strings for analysis
        const combinedReviewText = reviews
          .map(
            (review) =>
              `Rating: ${review.rating}/5\nAuthor: ${review.author}\nVerified: ${review.verified ? 'Yes' : 'No'}\nReview: ${review.text}`
          )
          .join('\n\n---\n\n');

        const result = await checkReview(combinedReviewText, request.log);

        return {
          result: result,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'SERVICE_ERROR',
          service: 'review-analyzer',
          details:
            'Internal server error occurred while processing the request',
          timestamp: new Date().toISOString(),
        });
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
            rating: 5,
            text: 'Best product ever! Amazing quality!',
            author: 'John D.',
            verified: true,
          },
          {
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
        expect.stringContaining('Best product ever'),
        expect.any(Object) // Fastify logger
      );
    });

    it('should return 400 when reviews are missing', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/check/amazon/reviews',
        payload: {},
      });

      expect(response.statusCode).toBe(400);

      const data = JSON.parse(response.payload) as ValidationErrorResponse;
      expect(data.error).toBe('VALIDATION_ERROR');
      expect(data.details).toContain('reviews');
      expect(data.validationErrors).toBeDefined();
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

      const data = JSON.parse(response.payload) as ValidationErrorResponse;
      expect(data.error).toBe('VALIDATION_ERROR');
      expect(data.details).toContain('Array must contain at least 1 element');
      expect(data.validationErrors).toBeDefined();
      expect(data.timestamp).toBeDefined();
      expect(mockCheckReview).not.toHaveBeenCalled();
    });

    it('should work without productContext', async () => {
      const mockAnalysis = {
        isFake: false,
        confidence: 0.3,
        reasons: ['Review appears genuine'],
        flags: [],
        summary: 'Review seems authentic',
      };

      mockCheckReview.mockResolvedValue(mockAnalysis);

      const requestBody: CheckAmazonReviewsRequest = {
        reviews: [
          {
            rating: 4,
            text: 'Great product, works as expected. Good value for money.',
            author: 'Mike R.',
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
      expect(mockCheckReview).toHaveBeenCalledWith(
        expect.stringContaining('Great product, works as expected'),
        expect.any(Object)
      );
    });

    it('should handle service errors gracefully', async () => {
      mockCheckReview.mockRejectedValue(new Error('Service unavailable'));

      const requestBody: CheckAmazonReviewsRequest = {
        reviews: [
          {
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

      const data = JSON.parse(response.payload) as ServiceErrorResponse;
      expect(data.error).toBe('SERVICE_ERROR');
      expect(data.service).toBe('review-analyzer');
      expect(data.timestamp).toBeDefined();

      expect(mockCheckReview).toHaveBeenCalledWith(
        expect.stringContaining('Test review'),
        expect.any(Object) // logger
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
