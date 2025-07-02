import { beforeEach, describe, expect, it, vi } from 'vitest';

import { checkReview } from './review-checker.js';

// Store mock function references
const mockCreate = vi.fn();

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  })),
}));

describe('Review checker service', () => {
  beforeEach(() => {
    mockCreate.mockClear();
  });

  it('parses OpenAI JSON response into ReviewChecker format', async () => {
    const mockResponse = {
      isFake: true,
      confidence: 0.85,
      reasons: ['Generic language without specific details'],
      flags: ['generic_language'],
      summary: 'Review appears to be fake based on generic praise',
    };

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(mockResponse),
          },
        },
      ],
    });

    const result = await checkReview('This product is amazing!');

    expect(result).toEqual(mockResponse);
  });

  it('returns safe fallback response when OpenAI API fails', async () => {
    mockCreate.mockRejectedValue(new Error('API Error'));

    const result = await checkReview('Test review');

    expect(result).toEqual({
      isFake: false,
      confidence: 0,
      reasons: ['Analysis failed - unable to determine authenticity'],
      flags: [],
      summary: 'Could not analyze review due to service error',
    });
  });
});
