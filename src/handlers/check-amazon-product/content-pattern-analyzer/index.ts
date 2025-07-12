import type { AmazonReview, RedFlag } from '@truestarhq/shared-types';
import OpenAI from 'openai';
import { z } from 'zod';

import { getConfig } from '../../../config/config.js';
import { log } from '../../../utils/logger.js';
import { ANALYSIS_PROMPT_TEMPLATE, SYSTEM_PROMPT } from './prompts.js';
import { ANALYSIS_RESPONSE_SCHEMA } from './schemas.js';

const AnalysisResponseSchema = z.object({
  redFlags: z.array(
    z.discriminatedUnion('type', [
      z.object({
        type: z.literal('phrase_repetition'),
        confidence: z.number().min(0).max(1),
        details: z.object({
          phrase: z.string(),
          reviewIds: z.array(z.string()),
        }),
      }),
      z.object({
        type: z.literal('excessive_positivity'),
        confidence: z.number().min(0).max(1),
        details: z.object({
          reviewIds: z.array(z.string()),
          keywords: z.array(z.string()).optional(),
        }),
      }),
      z.object({
        type: z.literal('review_bombing'),
        confidence: z.number().min(0).max(1),
        details: z.object({
          date: z.string(),
          reviewCount: z.number(),
          hoursSpan: z.number(),
          reviewIds: z.array(z.string()),
        }),
      }),
    ])
  ),
});

export async function analyzeContentPatterns(
  reviews: AmazonReview[]
): Promise<{ redFlags: RedFlag[] }> {
  try {
    const config = getConfig();
    const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

    const prompt = createAnalysisPrompt(reviews);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'review_analysis',
          strict: true,
          schema: ANALYSIS_RESPONSE_SCHEMA,
        },
      },
      temperature: 0.2,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    const parsedContent = JSON.parse(content);
    const validationResult = AnalysisResponseSchema.safeParse(parsedContent);

    if (!validationResult.success) {
      throw new Error(
        `Invalid OpenAI response format: ${validationResult.error.message}`
      );
    }

    const analysis = validationResult.data as { redFlags: RedFlag[] };

    log.info(
      {
        reviewCount: reviews.length,
        redFlagCount: analysis.redFlags.length,
      },
      'Content pattern analysis complete'
    );

    return analysis;
  } catch (error) {
    log.error({ error }, 'Content pattern analysis failed');
    // Return empty flags on error - let local detectors handle it
    return { redFlags: [] };
  }
}

function createAnalysisPrompt(reviews: AmazonReview[]): string {
  const reviewsJson = JSON.stringify(reviews, null, 2);
  return ANALYSIS_PROMPT_TEMPLATE.replace('{REVIEWS_JSON}', reviewsJson);
}
