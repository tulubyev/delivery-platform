FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json         apps/web/
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM deps AS builder
COPY packages/shared packages/shared
COPY apps/web         apps/web
ARG VITE_API_URL=https://api.delivery.yourdomain.ru
ENV VITE_API_URL=$VITE_API_URL
# shared собирается первым; ошибку не прячем (раньше `|| true` маскировал падение tsc)
RUN pnpm --filter @delivery/shared build
RUN pnpm --filter web build

# Финальный образ — просто статика (nginx берёт через volume)
FROM scratch AS export
COPY --from=builder /app/apps/web/dist /
