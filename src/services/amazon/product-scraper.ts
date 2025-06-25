import axios from 'axios';
import * as cheerio from 'cheerio';
import { ProductWithReviews, ReviewData } from './review-fetcher.js';
import { ProductContext } from '../../types/api.js';

export class AmazonProductScraper {
  private userAgent =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  async scrapeProduct(asin: string): Promise<ProductWithReviews> {
    const productUrl = `https://www.amazon.com/dp/${asin}`;

    // Fetch product page
    const productResponse = await axios.get(productUrl, {
      headers: {
        'User-Agent': this.userAgent,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    const $ = cheerio.load(productResponse.data);

    // Extract product details
    const product: ProductContext = {
      title: $('#productTitle').text().trim(),
      brand:
        $('.po-brand .po-break-word').text().trim() ||
        $('#bylineInfo').text().replace('Brand:', '').trim(),
      category: $('.a-breadcrumb .a-link-normal').first().text().trim(),
      price: this.extractPrice($),
      rating: this.extractRating($),
    };

    // Fetch reviews
    const reviewsUrl = `https://www.amazon.com/product-reviews/${asin}`;
    const reviewsResponse = await axios.get(reviewsUrl, {
      headers: {
        'User-Agent': this.userAgent,
      },
    });

    const $reviews = cheerio.load(reviewsResponse.data);
    const reviews = this.extractReviews($reviews);

    return { product, reviews };
  }

  private extractPrice($: cheerio.CheerioAPI): number | undefined {
    const priceText =
      $('.a-price-whole').first().text() ||
      $('.a-price.a-text-price.a-size-medium.apexPriceToPay').text() ||
      $('.a-price-range').first().text();

    if (priceText) {
      const price = parseFloat(priceText.replace(/[$,]/g, ''));
      return isNaN(price) ? undefined : price;
    }
    return undefined;
  }

  private extractRating($: cheerio.CheerioAPI): number | undefined {
    const ratingText = $('span.a-icon-alt').first().text();
    const match = ratingText.match(/(\d+\.?\d*) out of 5/);
    return match && match[1] ? parseFloat(match[1]) : undefined;
  }

  private extractReviews($: cheerio.CheerioAPI): ReviewData[] {
    const reviews: ReviewData[] = [];

    $('.review').each((index, element) => {
      const $review = $(element);
      const reviewId = $review.attr('id') || `review-${index}`;

      const ratingText = $review.find('.review-rating .a-icon-alt').text();
      const ratingMatch = ratingText.match(/(\d+\.?\d*) out of 5/);
      const rating =
        ratingMatch && ratingMatch[1] ? parseFloat(ratingMatch[1]) : 0;

      const review: ReviewData = {
        reviewId,
        rating,
        title: $review
          .find('.review-title span')
          .not('.a-icon-alt')
          .text()
          .trim(),
        text: $review.find('.review-text-content span').text().trim(),
        author: $review.find('.a-profile-name').text().trim(),
        date: $review
          .find('.review-date')
          .text()
          .replace('Reviewed in the United States on', '')
          .trim(),
        verified: $review.find('.avp-badge').length > 0,
        helpfulVotes: this.extractHelpfulVotes($review),
      };

      reviews.push(review);
    });

    return reviews;
  }

  private extractHelpfulVotes(
    $review: cheerio.Cheerio<cheerio.Element>
  ): number {
    const helpfulText = $review.find('.cr-vote-text').text();
    const match = helpfulText.match(/(\d+) people found this helpful/);
    return match && match[1] ? parseInt(match[1]) : 0;
  }
}

export const amazonProductScraper = new AmazonProductScraper();
