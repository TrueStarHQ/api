# ===== BUILD STAGE =====
FROM node:20-alpine AS builder

# Python, make, and g++ are required for building native Node.js modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY public ./public/
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ===== PRODUCTION STAGE =====
FROM node:20-alpine

# dumb-init ensures proper signal handling in containers (e.g., graceful shutdown)
RUN apk add --no-cache dumb-init

# Run as non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile --prod --ignore-scripts && \
    pnpm store prune

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 8080
ENV NODE_ENV=production

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]