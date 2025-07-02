# ===== BUILD STAGE =====
FROM node:20-alpine AS builder

# Python, make, and g++ are required for building native Node.js modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json yarn.lock .yarnrc.yml openapi.yaml orval.config.cjs ./
COPY .yarn/releases ./.yarn/releases
RUN corepack enable
RUN yarn install --immutable

COPY . .
RUN yarn build

# ===== PRODUCTION STAGE =====
FROM node:20-alpine

# dumb-init ensures proper signal handling in containers (e.g., graceful shutdown)
RUN apk add --no-cache dumb-init

# Run as non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

COPY package.json yarn.lock ./
RUN corepack enable && \
    yarn install --immutable --mode skip-build && \
    yarn cache clean

COPY --from=builder /app/dist ./dist

RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 8080
ENV NODE_ENV=production

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]