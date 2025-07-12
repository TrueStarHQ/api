export const SYSTEM_PROMPT = `You are an expert at detecting fake review patterns. Analyze Amazon product reviews for authenticity indicators and suspicious patterns.`;

export const ANALYSIS_PROMPT_TEMPLATE = `
Analyze these Amazon product reviews:

{REVIEWS_JSON}

Detect patterns across multiple reviews:
- phrase_repetition: Identical or very similar phrases used in multiple reviews
- excessive_positivity: Overly enthusiastic language without specific product details

Focus on patterns across the entire review set, not individual review quality.
`.trim();
