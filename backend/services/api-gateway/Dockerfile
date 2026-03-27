FROM oven/bun:1.2-alpine AS base
WORKDIR /app

# Install dependencies for the whole monorepo
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY services/api-gateway/package.json ./services/api-gateway/
RUN bun install --frozen-lockfile

# Build shared package
FROM deps AS builder
COPY packages/shared ./packages/shared
RUN cd packages/shared && bun run build

# Build api-gateway
COPY services/api-gateway ./services/api-gateway
RUN cd services/api-gateway && bun build src/index.ts --outdir dist --target bun

# Production image
FROM oven/bun:1.2-alpine AS runner
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/api-gateway/dist ./dist

ENV NODE_ENV=production
EXPOSE 3000

CMD ["bun", "run", "dist/index.js"]