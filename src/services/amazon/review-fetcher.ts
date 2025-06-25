import { ProductContext } from '../../types/api.js';
import { amazonProductScraper } from './product-scraper.js';

export interface ReviewData {
  reviewId: string;
  rating: number;
  title: string;
  text: string;
  author: string;
  date: string;
  verified: boolean;
  helpfulVotes: number;
}

export interface ProductWithReviews {
  product: ProductContext;
  reviews: ReviewData[];
}

export class AmazonReviewFetcher {
  async fetchProductReviews(asin: string): Promise<ProductWithReviews> {
    try {
      // For prototype: Direct scraping
      // TODO: For MVP add rate limiting, proxy rotation, caching
      return await amazonProductScraper.scrapeProduct(asin);
    } catch {
      // Log error internally - in production this would go to monitoring service

      // Fallback to mock data if scraping fails
      return {
        product: {
          title: `Product ${asin} (Failed to fetch)`,
          brand: 'Unknown',
          category: 'Unknown',
          price: 0,
          rating: 0,
        },
        reviews: [
          {
            reviewId: 'error',
            rating: 0,
            title: 'Failed to fetch reviews',
            text: 'Unable to retrieve reviews from Amazon. This might be due to rate limiting or network issues.',
            author: 'System',
            date: new Date().toISOString(),
            verified: false,
            helpfulVotes: 0,
          },
        ],
      };
    }
  }

  async fetchMultipleProducts(asins: string[]): Promise<ProductWithReviews[]> {
    // Fetch reviews for multiple products
    // In production, this would batch the requests efficiently
    const results = await Promise.all(
      asins.map((asin) => this.fetchProductReviews(asin))
    );
    return results;
  }
}

export const amazonReviewFetcher = new AmazonReviewFetcher();
