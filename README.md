# Delivery Platform — MVP

Node.js 20 + TypeScript 5 | Express | Prisma | PostgreSQL (Beget) | Redis | BullMQ | WebSocket | React + Vite | pnpm monorepo

## Структура

```
delivery-platform/
├── apps/
│   ├── api/                    # Backend Express (порт 3000)
│   │   ├── prisma/schema.prisma
│   │   └── src/
│   │       ├── modules/orders/     # router→controller→service→repository
│   │       ├── modules/users/      # auth, JWT
│   │       ├── modules/tracking/   # GPS, Redis кэш
│   │       ├── modules/payouts/    # выплаты курьерам
│   │       ├── modules/ws/         # WebSocket manager
│   │       ├── infrastructure/     # db, redis, queue (BullMQ)
│   │       ├── middleware/         # auth, validate, error
│   │       └── app.ts
│   └── web/                    # React кабинет
├── packages/shared/            # Общие Zod-схемы + типы
├── nginx/                      # Nginx конфиг
├── scripts/setup-vps.sh        # Первичная настройка Beget VPS
├── .github/workflows/deploy.yml
├── docker-compose.yml
└── .env.example
```

## Быстрый старт

```bash
npm install -g pnpm
pnpm install
cp .env.example .env   # заполнить DATABASE_URL (Beget) и JWT_SECRET
docker run -d -p 6379:6379 redis:7-alpine   # Redis локально
pnpm db:migrate        # создать таблицы
pnpm --filter api db:seed   # тестовые данные
pnpm dev:api           # API на http://localhost:3000
pnpm dev:web           # Web на http://localhost:5173
```

## Тестовые аккаунты (после seed)

| Роль | Email | Пароль |
|------|-------|--------|
| Admin | admin@delivery.local | Admin1234! |
| Dispatcher | dispatcher@delivery.local | Disp1234! |
| Courier | courier1@delivery.local | Courier123! |
| Client | client1@delivery.local | Client123! |

## API

```
POST /api/auth/register|login|refresh|logout
GET  /api/auth/me

GET    /api/orders              ?status=&clientId=&courierId=&page=&limit=
POST   /api/orders
GET    /api/orders/:id
POST   /api/orders/assign
PATCH  /api/orders/:id/status

GET  /api/tracking/online
GET  /api/tracking/courier/:id

GET  /api/payouts               ?courierId=
POST /api/payouts/calculate
POST /api/payouts/:id/approve
POST /api/payouts/:id/paid

GET  /health
WS   ws://localhost:3000/ws?token=<JWT>
```

## WebSocket события

**Клиент → Сервер:** `SUBSCRIBE_ORDER` | `SUBSCRIBE_COURIER` | `LOCATION_UPDATE`
**Сервер → Клиент:** `COURIER_LOCATION` | `ORDER_STATUS` | `ORDER_ASSIGNED` | `ETA_UPDATE`

## Деплой на Beget VPS

```bash
bash scripts/setup-vps.sh
# Добавить в GitHub Secrets: VPS_HOST, VPS_USER, VPS_SSH_KEY
# При пуше в main — автодеплой через GitHub Actions
```

## Для Replit

1. Создать Node.js Repl, загрузить файлы
2. В Secrets добавить: `DATABASE_URL`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `REDIS_URL` (Upstash)
3. В Shell: `npm i -g pnpm && pnpm install && pnpm db:migrate && pnpm dev:api`
