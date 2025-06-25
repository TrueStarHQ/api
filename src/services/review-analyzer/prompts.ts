// Individual prompt definitions
import { ProductContext } from '../../types/api.js';

export const SYSTEM_REVIEW_ANALYZER_PROMPT = `
You are an expert at detecting fake product reviews. Analyze the provided review and determine if it's likely to be fake or genuine.

Consider these factors:
- Generic or overly vague language
- Excessive positivity without specific details
- Mentions of incentives or free products
- Unnatural language patterns
- Repetitive phrases common in fake reviews
- Competitor mentions or comparisons
- Missing verification indicators

Respond with a JSON object containing:
- isFake: boolean (true if likely fake)
- confidence: number (0-1, how confident you are)
- reasons: array of specific reasons for your assessment
- flags: array of detected red flags from the predefined list
- summary: brief explanation of your analysis

Be thorough but concise. Focus on specific indicators rather than general impressions.`;

export function userReviewPrompt(
  reviewText: string,
  productContext?: ProductContext
): string {
  return `Review to analyze: "${reviewText}"

${
  productContext
    ? `Product context:
- Title: ${productContext.title || 'Unknown'}
- Brand: ${productContext.brand || 'Unknown'}
- Category: ${productContext.category || 'Unknown'}
- Price: ${productContext.price ? `$${productContext.price}` : 'Unknown'}
- Rating: ${productContext.rating ? `${productContext.rating}/5` : 'Unknown'}`
    : ''
}

Analyze this review for authenticity.`;
}
