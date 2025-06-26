import { describe, it, expect, vi } from 'vitest';
import { checkReview } from './review-checker.js';

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  })),
}));

describe('Review Checker Service', () => {
  it('should return check result for a review', async () => {
    const mockResponse = {
      isFake: true,
      confidence: 0.85,
      reasons: ['Generic language without specific details'],
      flags: ['generic_language'],
      summary: 'Review appears to be fake based on generic praise',
    };

    const OpenAI = (await import('openai')).default;
    const mockCreate = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(mockResponse),
          },
        },
      ],
    });

    const mockOpenAI = new OpenAI({ apiKey: 'test-key' });
    mockOpenAI.chat.completions.create = mockCreate;

    const result = await checkReview(
      'This product is amazing!',
      undefined
    );

    expect(result).toBeDefined();
    expect(typeof result.isFake).toBe('boolean');
    expect(typeof result.confidence).toBe('number');
    expect(Array.isArray(result.reasons)).toBe(true);
    expect(Array.isArray(result.flags)).toBe(true);
    expect(typeof result.summary).toBe('string');
  });

  it('should handle OpenAI API errors gracefully', async () => {
    const OpenAI = (await import('openai')).default;
    const mockCreate = vi.fn().mockRejectedValue(new Error('API Error'));

    const mockOpenAI = new OpenAI({ apiKey: 'test-key' });
    mockOpenAI.chat.completions.create = mockCreate;

    const result = await checkReview('Test review', undefined);

    expect(result).toEqual({
      isFake: false,
      confidence: 0,
      reasons: ['Analysis failed - unable to determine authenticity'],
      flags: [],
      summary: 'Could not analyze review due to service error',
    });
  });
});
