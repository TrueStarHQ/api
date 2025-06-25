# Review Analyzer

A TypeScript service for analyzing product reviews to detect fake reviews using OpenAI's GPT models.

## Features

- Fastify-based REST API
- OpenAI integration for review analysis
- TypeScript with strict type checking
- Zod schema validation
- CORS support for browser extensions
- Health check endpoint

## Setup

1. Install dependencies:
```bash
yarn install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Add your OpenAI API key to `.env`:
```bash
OPENAI_API_KEY=your_api_key_here
```

## Development

Start the development server:
```bash
yarn dev
```

The server will start on `http://localhost:3001` by default.

## API Endpoints

### Health Check
```
GET /health
```

### Check Amazon Reviews
```
POST /check/amazon/reviews
Content-Type: application/json

{
  "reviews": [
    "This product is amazing! Best purchase ever!",
    "Absolutely perfect in every way! Highly recommend!"
  ],
  "productContext": {
    "title": "Product Name",
    "brand": "Brand Name",
    "category": "Electronics",
    "price": 99.99,
    "rating": 5
  }
}
```

Response:
```json
{
  "analysis": {
    "isFake": true,
    "confidence": 0.8,
    "reasons": ["Excessive positivity without specific details"],
    "flags": ["excessive_positivity", "generic_language"],
    "summary": "Review appears fake due to generic praise without specific product details"
  },
  "timestamp": "2024-12-22T10:00:00.000Z"
}
```

## Scripts

- `yarn dev` - Start development server with hot reload
- `yarn build` - Compile TypeScript to JavaScript
- `yarn start` - Start production server
- `yarn check` - Type check without emitting files
- `yarn lint` - Run ESLint
- `yarn lint:fix` - Fix ESLint issues
- `yarn format` - Format code with Prettier
- `yarn format:check` - Check code formatting
- `yarn test` - Run tests