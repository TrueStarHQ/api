import { describe, it, expect, vi } from 'vitest';
import { analyzeReview } from './review-analysis.js';

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  })),
}));

describe('Review Analysis Service', () => {
  it('should return analysis for a review', async () => {
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

    const analysis = await analyzeReview(
      'This product is amazing!',
      undefined,
      undefined
    );

    expect(analysis).toBeDefined();
    expect(typeof analysis.isFake).toBe('boolean');
    expect(typeof analysis.confidence).toBe('number');
    expect(Array.isArray(analysis.reasons)).toBe(true);
    expect(Array.isArray(analysis.flags)).toBe(true);
    expect(typeof analysis.summary).toBe('string');
  });

  it('should handle OpenAI API errors gracefully', async () => {
    const OpenAI = (await import('openai')).default;
    const mockCreate = vi.fn().mockRejectedValue(new Error('API Error'));

    const mockOpenAI = new OpenAI({ apiKey: 'test-key' });
    mockOpenAI.chat.completions.create = mockCreate;

    const analysis = await analyzeReview('Test review', undefined, undefined);

    expect(analysis).toEqual({
      isFake: false,
      confidence: 0,
      reasons: ['Analysis failed - unable to determine authenticity'],
      flags: [],
      summary: 'Could not analyze review due to service error',
    });
  });
});
