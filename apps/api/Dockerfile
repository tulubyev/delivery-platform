FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

# ── deps: только манифесты для кэша слоёв ────────────────────────────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json         apps/api/
RUN pnpm install --frozen-lockfile --ignore-scripts

# ── builder ───────────────────────────────────────────────────────────────
FROM deps AS builder
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api         apps/api
RUN pnpm --filter api exec prisma generate
RUN pnpm --filter @delivery/shared build || true
RUN pnpm --filter api build

# ── runner (production зависимости) ──────────────────────────────────────
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app
ENV NODE_ENV=production PORT=3000

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json         apps/api/
RUN pnpm install --frozen-lockfile --ignore-scripts --prod

# Prisma: schema + сгенерированный client через RUN (поддерживает glob)
COPY --from=builder /app/node_modules/.prisma      node_modules/.prisma
COPY --from=builder /app/apps/api/prisma           apps/api/prisma
RUN --mount=type=bind,from=builder,source=/app/node_modules/.pnpm,target=/builder_pnpm \
    cp -r /builder_pnpm/@prisma+client@5.22.0 node_modules/.pnpm/ 2>/dev/null || \
    find /builder_pnpm -maxdepth 1 -name "@prisma+client*" -exec cp -r {} node_modules/.pnpm/ \; || true

# Собранный JS
COPY --from=builder /app/apps/api/dist apps/api/dist

RUN mkdir -p /app/uploads
EXPOSE 3000
WORKDIR /app/apps/api

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/app.js"]
