# TrueStar API

RESTful API service for analyzing product reviews and detecting potentially fake or misleading content.

## Overview

This API serves as the backend for the TrueStar browser extension, providing review analysis capabilities powered by OpenAI's language models.

## Architecture

- **Framework**: Fastify (Node.js)
- **Language**: TypeScript
- **Validation**: Zod schemas
- **API Documentation**: OpenAPI 3.1 specification

### API-First Development

The OpenAPI specification (`openapi.yaml`) serves as the single source of truth for the API contract. TypeScript types and Zod validation schemas are automatically generated from this spec using Orval, ensuring type safety and consistency across the codebase.

## Development

```bash
# Install dependencies
yarn install

# Start development server
yarn dev

# Run tests
yarn test

# Build for production
yarn build
```

## Deployment

The API is containerized using Docker and deployed to Google Cloud Run. See `Dockerfile` for the container configuration.

## Environment Variables

- `OPENAI_API_KEY` (required): API key for OpenAI services
- `PORT`: Server port (default: 8080)
- `NODE_ENV`: Environment mode (development/production)