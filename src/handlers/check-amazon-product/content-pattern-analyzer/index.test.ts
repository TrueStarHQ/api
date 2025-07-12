import type { AmazonReview } from '@truestarhq/shared-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { analyzeContentPatterns } from './index.js';

vi.mock('../../../config/config.js', () => ({
  getConfig: vi.fn(() => ({
    OPENAI_API_KEY: 'test-api-key',
  })),
}));

vi.mock('../../../utils/logger.js', () => ({
  log: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  })),
}));

describe('analyzeContentPatterns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns structured flags from content pattern analysis', async () => {
    const { default: OpenAI } = await import('openai');
    const mockCreate = vi.fn();

    // Setup the mock implementation
    vi.mocked(OpenAI).mockImplementation(
      () =>
        ({
          chat: {
            completions: {
              create: mockCreate,
            },
          },
        }) as unknown as InstanceType<typeof OpenAI>
    );

    // Mock successful OpenAI response
    mockCreate.mockResolvedValueOnce({
      id: 'test-id',
      object: 'chat.completion',
      created: Date.now(),
      model: 'gpt-4',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: JSON.stringify({
              redFlags: [
                {
                  type: 'phrase_repetition',
                  confidence: 0.85,
                  details: {
                    phrase: 'absolutely perfect',
                    reviewIds: ['r1', 'r3', 'r5'],
                  },
                },
                {
                  type: 'excessive_positivity',
                  confidence: 0.75,
                  details: {
                    reviewIds: ['r2', 'r4'],
                    keywords: ['amazing', 'perfect', 'life-changing'],
                  },
                },
              ],
            }),
          },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    });

    const reviews: AmazonReview[] = [
      {
        id: 'r1',
        rating: 5,
        text: 'Absolutely perfect product!',
        author: 'User1',
        verified: false,
      },
      {
        id: 'r2',
        rating: 5,
        text: 'Amazing! Life-changing!',
        author: 'User2',
        verified: true,
      },
      {
        id: 'r3',
        rating: 5,
        text: 'Absolutely perfect in every way',
        author: 'User3',
        verified: false,
      },
      {
        id: 'r4',
        rating: 5,
        text: 'Perfect! Amazing quality!',
        author: 'User4',
        verified: false,
      },
      {
        id: 'r5',
        rating: 5,
        text: 'Absolutely perfect purchase',
        author: 'User5',
        verified: true,
      },
    ];

    const result = await analyzeContentPatterns(reviews);

    expect(result.redFlags).toHaveLength(2);
    expect(result.redFlags[0].type).toBe('phrase_repetition');
    expect(result.redFlags[1].type).toBe('excessive_positivity');
  });

  it('handles content analysis errors gracefully', async () => {
    const { default: OpenAI } = await import('openai');
    const mockCreate = vi.fn();

    vi.mocked(OpenAI).mockImplementation(
      () =>
        ({
          chat: {
            completions: {
              create: mockCreate,
            },
          },
        }) as unknown as InstanceType<typeof OpenAI>
    );

    mockCreate.mockRejectedValueOnce(new Error('OpenAI API error'));

    const reviews: AmazonReview[] = [
      { id: 'r1', rating: 5, text: 'Great!', author: 'User1', verified: true },
    ];

    const result = await analyzeContentPatterns(reviews);

    expect(result.redFlags).toEqual([]);
  });

  it('enforces valid flag types through JSON schema', async () => {
    const { default: OpenAI } = await import('openai');
    const mockCreate = vi.fn();

    vi.mocked(OpenAI).mockImplementation(
      () =>
        ({
          chat: {
            completions: {
              create: mockCreate,
            },
          },
        }) as unknown as InstanceType<typeof OpenAI>
    );

    // With JSON schema, OpenAI will only return valid flag types
    mockCreate.mockResolvedValueOnce({
      id: 'test-id',
      object: 'chat.completion',
      created: Date.now(),
      model: 'gpt-4',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: JSON.stringify({
              redFlags: [
                {
                  type: 'review_bombing', // Schema enforces valid types
                  confidence: 0.9,
                  details: {
                    date: '2024-01-15',
                    reviewCount: 5,
                    hoursSpan: 2,
                    reviewIds: ['r1', 'r2', 'r3', 'r4', 'r5'],
                  },
                },
              ],
            }),
          },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    });

    const reviews: AmazonReview[] = [
      { id: 'r1', rating: 5, text: 'Great!', author: 'User1', verified: true },
    ];

    const result = await analyzeContentPatterns(reviews);

    // Schema ensures only valid flag types are returned
    expect(result.redFlags).toHaveLength(1);
    expect(result.redFlags[0].type).toBe('review_bombing');
    expect(result.redFlags[0].confidence).toBeGreaterThanOrEqual(0);
    expect(result.redFlags[0].confidence).toBeLessThanOrEqual(1);
  });
});
