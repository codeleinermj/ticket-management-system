FROM node:22-alpine AS base
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY services/ai-worker/package.json ./services/ai-worker/
RUN pnpm install --frozen-lockfile

# Build
FROM deps AS builder
COPY packages/shared ./packages/shared
COPY packages/database ./packages/database
RUN cd packages/shared && pnpm run build
RUN cd packages/database && npx prisma generate --schema=prisma/schema.prisma

COPY services/ai-worker ./services/ai-worker
RUN cd services/ai-worker && npx tsup src/index.ts --format cjs

# Production image
FROM node:22-alpine AS runner
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/ai-worker/dist ./dist

ENV NODE_ENV=production

CMD ["node", "dist/index.cjs"]