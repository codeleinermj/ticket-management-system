FROM oven/bun:1.2-alpine AS base
WORKDIR /app

# Install dependencies for the whole monorepo
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY services/ticket-service/package.json ./services/ticket-service/
RUN bun install --frozen-lockfile

# Build shared packages
FROM deps AS builder
COPY packages/shared ./packages/shared
COPY packages/database ./packages/database
RUN cd packages/shared && bun run build

# Generate Prisma client
RUN cd packages/database && bunx prisma generate --schema=prisma/schema.prisma

# Build ticket-service
COPY services/ticket-service ./services/ticket-service
RUN cd services/ticket-service && bunx tsup src/index.ts --format cjs

# Production image
FROM node:22-alpine AS runner
WORKDIR /app

RUN npm install -g prisma@6.3.0

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/ticket-service/dist ./dist

ENV NODE_ENV=production
EXPOSE 3001

# Run migrations then start
CMD ["sh", "-c", "prisma migrate deploy --schema=/app/packages/database/prisma/schema.prisma && node dist/index.cjs"]