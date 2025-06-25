import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { analyzeReview } from './services/review-analyzer/index.js';
import {
  AnalyzeReviewsRequest,
  AnalyzeReviewsRequestSchema,
  ScanResponse,
  ErrorResponse,
  ValidationErrorResponse,
  ServiceErrorResponse,
  HealthResponse,
} from './types/api.js';

// Mock the review analyzer service
vi.mock('./services/review-analyzer/index.js', () => ({
  analyzeReview: vi.fn(),
}));

const mockAnalyzeReview = vi.mocked(analyzeReview);

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

    // Generic review analysis endpoint
    fastify.post<{
      Body: AnalyzeReviewsRequest;
      Reply: ScanResponse | ErrorResponse;
    }>('/analyze/reviews', async (request, reply) => {
      try {
        // Validate request body using Zod schema
        const validationResult = AnalyzeReviewsRequestSchema.safeParse(
          request.body
        );

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

        const { reviews, productContext } = validationResult.data;

        // Combine all reviews for analysis
        const combinedReviewText = reviews.join('\n\n---\n\n');

        const result = await analyzeReview(
          combinedReviewText,
          productContext,
          request.log
        );

        return {
          analysis: result,
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

  describe('POST /analyze/reviews', () => {
    it('should analyze product reviews successfully', async () => {
      const mockAnalysis = {
        isFake: true,
        confidence: 0.85,
        reasons: ['Multiple fake reviews detected'],
        flags: ['generic_language' as const, 'suspicious_timing' as const],
        summary: 'Product has suspicious review patterns',
      };

      mockAnalyzeReview.mockResolvedValue(mockAnalysis);

      const requestBody: AnalyzeReviewsRequest = {
        reviews: [
          'Best product ever! Amazing quality!',
          'Absolutely perfect in every way! Highly recommend!',
        ],
        productContext: {
          title: 'Test Product',
          brand: 'Test Brand',
          category: 'Electronics',
          price: 29.99,
          rating: 4.5,
        },
      };

      const response = await fastify.inject({
        method: 'POST',
        url: '/analyze/reviews',
        payload: requestBody,
      });

      expect(response.statusCode).toBe(200);

      const data = JSON.parse(response.payload) as ScanResponse;
      expect(data.analysis).toEqual(mockAnalysis);
      expect(data.timestamp).toBeDefined();
      expect(typeof data.timestamp).toBe('string');

      // Verify the service was called with correct parameters
      expect(mockAnalyzeReview).toHaveBeenCalledWith(
        expect.stringContaining('Best product ever'),
        requestBody.productContext,
        expect.any(Object) // Fastify logger
      );
    });

    it('should return 400 when reviews are missing', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/analyze/reviews',
        payload: {},
      });

      expect(response.statusCode).toBe(400);

      const data = JSON.parse(response.payload) as ValidationErrorResponse;
      expect(data.error).toBe('VALIDATION_ERROR');
      expect(data.details).toContain('reviews');
      expect(data.validationErrors).toBeDefined();
      expect(data.timestamp).toBeDefined();
      expect(mockAnalyzeReview).not.toHaveBeenCalled();
    });

    it('should return 400 when reviews array is empty', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/analyze/reviews',
        payload: {
          reviews: [],
        },
      });

      expect(response.statusCode).toBe(400);

      const data = JSON.parse(response.payload) as ValidationErrorResponse;
      expect(data.error).toBe('VALIDATION_ERROR');
      expect(data.details).toContain('At least one review is required');
      expect(data.validationErrors).toBeDefined();
      expect(data.timestamp).toBeDefined();
      expect(mockAnalyzeReview).not.toHaveBeenCalled();
    });

    it('should work without productContext', async () => {
      const mockAnalysis = {
        isFake: false,
        confidence: 0.3,
        reasons: ['Review appears genuine'],
        flags: [],
        summary: 'Review seems authentic',
      };

      mockAnalyzeReview.mockResolvedValue(mockAnalysis);

      const requestBody: AnalyzeReviewsRequest = {
        reviews: ['Great product, works as expected. Good value for money.'],
      };

      const response = await fastify.inject({
        method: 'POST',
        url: '/analyze/reviews',
        payload: requestBody,
      });

      expect(response.statusCode).toBe(200);

      const data = JSON.parse(response.payload) as ScanResponse;
      expect(data.analysis).toEqual(mockAnalysis);
      expect(mockAnalyzeReview).toHaveBeenCalledWith(
        'Great product, works as expected. Good value for money.',
        undefined,
        expect.any(Object)
      );
    });

    it('should handle service errors gracefully', async () => {
      mockAnalyzeReview.mockRejectedValue(new Error('Service unavailable'));

      const requestBody: AnalyzeReviewsRequest = {
        reviews: ['Test review'],
      };

      const response = await fastify.inject({
        method: 'POST',
        url: '/analyze/reviews',
        payload: requestBody,
      });

      expect(response.statusCode).toBe(500);

      const data = JSON.parse(response.payload) as ServiceErrorResponse;
      expect(data.error).toBe('SERVICE_ERROR');
      expect(data.service).toBe('review-analyzer');
      expect(data.timestamp).toBeDefined();

      expect(mockAnalyzeReview).toHaveBeenCalledWith(
        'Test review',
        undefined,
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
        url: '/analyze/reviews',
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
