# LastMiles — Платформа управления доставкой последней мили

**Стек:** Node.js 20 · TypeScript · Express · Prisma 5 · PostgreSQL · Redis · BullMQ · WebSocket · React + Vite · Expo (React Native) · pnpm монорепо · Docker

**Продакшн:** https://lastmiles.ru · API: https://api.lastmiles.ru · VPS: 62.217.178.173

---

## Структура монорепо

```
delivery-platform/
├── apps/
│   ├── api/                        # Backend Express (Docker, порт 3100 на VPS)
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── seed.ts             # Тестовые данные
│   │   │   └── migrations/
│   │   └── src/
│   │       ├── modules/
│   │       │   ├── users/          # auth (JWT + SMS OTP), профили
│   │       │   ├── orders/         # CRUD заказов, назначение
│   │       │   ├── couriers/       # профиль, статистика, маршрут
│   │       │   ├── tracking/       # GPS, Redis кэш, история трека
│   │       │   ├── shifts/         # смены курьеров
│   │       │   ├── zones/          # зоны доставки
│   │       │   ├── warehouses/     # склады и статистика
│   │       │   ├── payments/       # выплаты курьерам
│   │       │   ├── alerts/         # алерты супервизора
│   │       │   └── ws/             # WebSocket manager (Redis pub/sub)
│   │       ├── infrastructure/     # db, redis, queue (BullMQ)
│   │       ├── middleware/         # auth, validate, error
│   │       └── app.ts
│   ├── web/                        # React SPA (nginx, /var/www/lastmiles/apps/web/dist)
│   │   └── src/
│   │       ├── layouts/            # AdminLayout, SupervisorLayout, CourierLayout, ClientLayout
│   │       ├── pages/
│   │       │   ├── auth/           # LoginPage, RegisterPage (+ SMS OTP)
│   │       │   ├── admin/          # Dashboard, Orders, Couriers, Shifts, Zones, Warehouses, Payments, Alerts, Settings
│   │       │   ├── supervisor/     # MapPage (2GIS + live WS), Alerts, Couriers
│   │       │   ├── courier/        # Dashboard (статистика), Orders, PlanPage (2GIS маршрут)
│   │       │   └── client/         # Dashboard, Orders, CreateOrder, OrderDetail, Docs
│   │       ├── queries/            # React Query хуки
│   │       └── hooks/              # useWebSocket
│   └── mobile/                     # Expo (React Native) — курьерское приложение
│       └── src/
│           ├── screens/            # Login, Home, Orders, Offer, Profile
│           ├── navigation/
│           ├── store/
│           └── hooks/
└── packages/
    └── shared/                     # Zod-схемы, типы, хелперы (используется API и Web)
```

---

## Роли пользователей

| Роль | Кабинет | Описание |
|------|---------|----------|
| `ADMIN` / `ORG_ADMIN` | `/admin` | Полное управление платформой |
| `SUPERVISOR` | `/supervisor` | Карта с курьерами онлайн, алерты, заказы |
| `COURIER` | `/courier` | Дашборд со статистикой, заказы, планирование маршрута |
| `CLIENT` | `/client` | Создание заказов, отслеживание, документы |

---

## Тестовые аккаунты (после seed)

| Роль | Email | Пароль |
|------|-------|--------|
| Admin | admin@lastmiles.ru | Admin1234! |
| Org Admin | orgadmin@lastmiles.ru | OrgAdmin1234! |
| Supervisor | supervisor@lastmiles.ru | Supervisor1234! |
| Курьер 1 | courier1@lastmiles.ru | Courier1234! |
| Курьер 2 | courier2@lastmiles.ru | Courier1234! |
| Client | client@lastmiles.ru | Client1234! |

---

## API endpoints

```
# Авторизация
POST /api/auth/register          # name, email, phone, password, role → {userId, phone}
POST /api/auth/verify-phone      # {userId, otp} → токены
POST /api/auth/resend-otp        # {userId}
POST /api/auth/login             # email, password → токены
POST /api/auth/refresh           # refreshToken → новые токены
POST /api/auth/logout
GET  /api/auth/me

# Заказы
GET    /api/orders               ?status=&courierId=&clientId=&page=&limit=
POST   /api/orders
GET    /api/orders/:id
POST   /api/orders/assign        # {orderId, courierId}
PATCH  /api/orders/:id/status    # {status, comment, photoUrl, lat, lon}

# Курьеры
GET  /api/couriers               ?verificationStatus=&page=&limit=
GET  /api/couriers/me            # профиль текущего курьера
GET  /api/couriers/me/stats      # статистика today/week/month
GET  /api/couriers/me/plan       # заказы для планирования маршрута ?date=YYYY-MM-DD
POST /api/couriers/me/documents  # загрузка документов
PATCH /api/couriers/:id/verify   # верификация (ADMIN/ORG_ADMIN)

# Трекинг
GET  /api/tracking/online        # онлайн курьеры организации
GET  /api/tracking/courier/:id   # текущая позиция курьера

# Смены
GET  /api/shifts                 ?date=&courierId=&status=
POST /api/shifts
GET  /api/shifts/:id
PATCH /api/shifts/:id
POST /api/shifts/:id/start
POST /api/shifts/:id/end
DELETE /api/shifts/:id

# Зоны
GET  /api/zones
POST /api/zones
PATCH /api/zones/:id
DELETE /api/zones/:id

# Склады
GET  /api/warehouses
POST /api/warehouses
GET  /api/warehouses/:id
PATCH /api/warehouses/:id
GET  /api/warehouses/:id/stats   ?date=YYYY-MM-DD

# Выплаты
GET  /api/payments               ?courierId=
POST /api/payments/calculate
POST /api/payments/:id/approve
POST /api/payments/:id/paid

# Алерты
GET  /api/alerts                 ?resolved=false
PATCH /api/alerts/:id/resolve

GET  /health
WS   wss://api.lastmiles.ru/ws?token=<JWT>
```

---

## WebSocket

**Клиент → Сервер:**
| Событие | Payload | Описание |
|---------|---------|----------|
| `SUBSCRIBE_ORDER` | `{orderId}` | Подписка на обновления заказа |
| `SUBSCRIBE_COURIER` | `{courierId}` | Подписка на локацию курьера |
| `SUBSCRIBE_ORG` | `{}` | Все события организации (супервизор) |
| `LOCATION_UPDATE` | `{courierId, lat, lon, speed, heading, accuracy, timestamp}` | Обновление локации (курьер) |

**Сервер → Клиент:**
| Событие | Описание |
|---------|----------|
| `COURIER_LOCATION` | Новые координаты курьера |
| `ORDER_STATUS` | Изменение статуса заказа |
| `ORDER_ASSIGNED` | Заказ назначен курьеру |
| `ETA_UPDATE` | Обновление времени прибытия |

---

## Инфраструктура (VPS)

```
62.217.178.173 (Beget VPS)
├── nginx (системный)
│   ├── lastmiles.ru → /var/www/lastmiles/apps/web/dist  (React SPA)
│   └── api.lastmiles.ru → 127.0.0.1:3100                (Docker API)
├── Docker Compose
│   ├── delivery-api   (Node.js, внутренний порт 3000 → внешний 3100)
│   └── delivery-redis (Redis 7, порт 6379)
└── PostgreSQL (Beget managed, внешний хост)
```

**Сборка и деплой:**
```bash
# На VPS — обновить код
cd /var/www/lastmiles
git pull

# Пересобрать и перезапустить API
docker compose build api && docker compose up -d api

# Пересобрать веб
cd apps/web
VITE_TWOGIS_API_KEY=<key> VITE_API_URL=https://api.lastmiles.ru pnpm build
```

---

## Локальная разработка

```bash
# Установка
npm install -g pnpm
pnpm install

# Настройка окружения
cp .env.example apps/api/.env
# Заполнить: DATABASE_URL, JWT_SECRET, REFRESH_TOKEN_SECRET, REDIS_URL, SMS_RU_API_KEY

# Redis локально
docker run -d -p 6379:6379 redis:7-alpine

# Миграции и seed
pnpm --filter api exec prisma migrate dev
pnpm --filter api exec prisma db seed

# Запуск
pnpm dev:api           # http://localhost:3000
pnpm dev:web           # http://localhost:5173
cd apps/mobile && npx expo start   # QR для Expo Go
```

---

## Мобильное приложение (Expo)

```bash
cd apps/mobile
npm install
npx expo start          # Сканировать QR в Expo Go

# Сборка APK (Android) для тестирования
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

**Переменные окружения мобилки:** `EXPO_PUBLIC_API_URL=https://api.lastmiles.ru`

---

## Переменные окружения API

```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
JWT_SECRET=...
REFRESH_TOKEN_SECRET=...
PORT=3000
NODE_ENV=production
SMS_RU_API_KEY=...
ALLOWED_ORIGINS=https://lastmiles.ru
```
