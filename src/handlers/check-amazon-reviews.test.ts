import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkAmazonReviewsHandler } from './check-amazon-reviews.js';
import type { CheckAmazonReviewsRequest } from '../types/generated/index.js';
import {
  createMockRequest,
  createMockReply,
} from '../../test/fastify-mocks.js';

// Mock the service
vi.mock('../services/review-checker/review-checker.js', () => ({
  checkReview: vi.fn(),
}));

import { checkReview } from '../services/review-checker/review-checker.js';

describe('checkAmazonReviewsHandler', () => {
  const mockedCheckReview = vi.mocked(checkReview);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validation', () => {
    it('returns 400 when reviews field is missing', async () => {
      const mockRequest = createMockRequest<CheckAmazonReviewsRequest>({
        body: {} as CheckAmazonReviewsRequest,
      });

      const mockReply = createMockReply();

      await checkAmazonReviewsHandler(mockRequest, mockReply);

      expect(mockReply.sendError).toHaveBeenCalledWith({
        statusCode: 400,
        error: 'VALIDATION_ERROR',
        details: expect.stringContaining('reviews'),
        timestamp: expect.any(String),
      });
    });

    it('returns 400 when reviews array is empty', async () => {
      const mockRequest = createMockRequest<CheckAmazonReviewsRequest>({
        body: { reviews: [] },
      });

      const mockReply = createMockReply();

      await checkAmazonReviewsHandler(mockRequest, mockReply);

      expect(mockReply.sendError).toHaveBeenCalledWith({
        statusCode: 400,
        error: 'VALIDATION_ERROR',
        details: expect.stringContaining(
          'Array must contain at least 1 element'
        ),
        timestamp: expect.any(String),
      });
    });

    it('returns 400 when rating is out of range', async () => {
      const mockRequest = createMockRequest<CheckAmazonReviewsRequest>({
        body: {
          reviews: [
            {
              id: 'test-1',
              rating: 6,
              text: 'Great',
              author: 'User',
              verified: true,
            },
          ],
        },
      });

      const mockReply = createMockReply();

      await checkAmazonReviewsHandler(mockRequest, mockReply);

      expect(mockReply.sendError).toHaveBeenCalledWith({
        statusCode: 400,
        error: 'VALIDATION_ERROR',
        details: expect.stringContaining('rating'),
        timestamp: expect.any(String),
      });
    });

    it('returns 400 when required fields are missing', async () => {
      const mockRequest = createMockRequest<CheckAmazonReviewsRequest>({
        body: {
          reviews: [
            {
              id: 'test-1',
              rating: 4,
              // missing text, author, verified
            },
          ],
        } as CheckAmazonReviewsRequest,
      });

      const mockReply = createMockReply();

      await checkAmazonReviewsHandler(mockRequest, mockReply);

      expect(mockReply.sendError).toHaveBeenCalledWith({
        statusCode: 400,
        error: 'VALIDATION_ERROR',
        details: expect.any(String),
        timestamp: expect.any(String),
      });
    });
  });

  describe('successful processing', () => {
    it('processes valid review data and returns result', async () => {
      mockedCheckReview.mockResolvedValue({
        isFake: false,
        confidence: 0.9,
        reasons: [],
        flags: [],
        summary: 'Review appears genuine',
      });

      const mockRequest = createMockRequest<CheckAmazonReviewsRequest>({
        body: {
          reviews: [
            {
              id: 'test-1',
              rating: 5,
              text: 'Great product!',
              author: 'Test User',
              verified: true,
            },
          ],
        },
      });

      const mockReply = createMockReply();

      const result = await checkAmazonReviewsHandler(mockRequest, mockReply);

      expect(mockedCheckReview).toHaveBeenCalledWith(
        expect.stringContaining('Rating: 5/5')
      );
      expect(result).toEqual({
        result: {
          isFake: false,
          confidence: 0.9,
          reasons: [],
          flags: [],
          summary: 'Review appears genuine',
        },
        timestamp: expect.any(String),
      });
      expect(mockReply.sendError).not.toHaveBeenCalled();
    });

    it('formats multiple reviews correctly', async () => {
      mockedCheckReview.mockResolvedValue({
        isFake: false,
        confidence: 0.9,
        reasons: [],
        flags: [],
        summary: 'Review appears genuine',
      });

      const mockRequest = createMockRequest<CheckAmazonReviewsRequest>({
        body: {
          reviews: [
            {
              id: 'test-1',
              rating: 5,
              text: 'Great!',
              author: 'User1',
              verified: true,
            },
            {
              id: 'test-2',
              rating: 3,
              text: 'OK',
              author: 'User2',
              verified: false,
            },
          ],
        },
      });

      const mockReply = createMockReply();

      await checkAmazonReviewsHandler(mockRequest, mockReply);

      expect(mockedCheckReview).toHaveBeenCalledWith(
        expect.stringContaining(
          'Rating: 5/5\nAuthor: User1\nVerified: Yes\nReview: Great!\n\n---\n\nRating: 3/5\nAuthor: User2\nVerified: No\nReview: OK'
        )
      );
    });
  });

  describe('error handling', () => {
    it('returns 500 when checkReview throws an error', async () => {
      const error = new Error('Service error');
      mockedCheckReview.mockRejectedValue(error);

      const mockRequest = createMockRequest<CheckAmazonReviewsRequest>({
        body: {
          reviews: [
            {
              id: 'test-1',
              rating: 5,
              text: 'Great!',
              author: 'User',
              verified: true,
            },
          ],
        },
      });

      const mockReply = createMockReply();

      await checkAmazonReviewsHandler(mockRequest, mockReply);

      expect(mockRequest.log.error).toHaveBeenCalledWith(
        { error, requestBody: mockRequest.body },
        'Error processing review analysis request'
      );
      expect(mockReply.sendError).toHaveBeenCalledWith({
        statusCode: 500,
        error: 'SERVICE_ERROR',
        details: 'Internal server error occurred while processing the request',
        timestamp: expect.any(String),
      });
    });
  });
});
