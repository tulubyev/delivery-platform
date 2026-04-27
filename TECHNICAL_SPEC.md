# Техническое задание
# Платформа управления доставкой последней мили

**Версия:** 1.0  
**Дата:** 2026-04-26  
**Модель:** B2B2C — платформа продаётся компаниям-доставщикам (B2B), которые доставляют физлицам-получателям (C)

---

## Содержание

1. [Обзор системы](#1-обзор-системы)
2. [Стек технологий](#2-стек-технологий)
3. [Архитектура](#3-архитектура)
4. [Роли пользователей](#4-роли-пользователей)
5. [Модули и сервисы](#5-модули-и-сервисы)
6. [Процессы и контрольные точки](#6-процессы-и-контрольные-точки)
7. [Безопасность и шифрование](#7-безопасность-и-шифрование)
8. [Интеграции](#8-интеграции)
9. [Нефункциональные требования](#9-нефункциональные-требования)
10. [Порядок реализации](#10-порядок-реализации)

---

## 1. Обзор системы

Мультитенантная SaaS-платформа для автоматизации доставки последней мили.

**Основные возможности:**
- Онбординг и верификация курьеров (паспорт, ИНН)
- Автоматический и конкурентный диспетчинг заказов
- Оптимизация маршрутов (TSP + 2GIS Distance Matrix)
- GPS-трекинг курьеров в реальном времени
- Мониторинг и алерты для супервизора
- Уведомления получателей (SMS, WhatsApp, звонки)
- Публичная страница трекинга для получателя
- Расчёт и управление выплатами курьерам
- Настраиваемая конфигурация под каждую организацию

**Мультитенантность:** единая база данных с изоляцией по `organization_id`. Каждая организация имеет свой набор курьеров, клиентов, заказов, зон и настроек.

---

## 2. Стек технологий

### Backend — `apps/api`
| Компонент | Технология | Обоснование |
|---|---|---|
| Runtime | Node.js 22 LTS | Стабильность, экосистема |
| Framework | Express.js | Минимализм, гибкость |
| Language | TypeScript 5 | Типобезопасность |
| ORM | Prisma 5 | Типизированный клиент, миграции (см. обоснование ниже) |
| Database | PostgreSQL 16 | Надёжность, JSON, GIS-расширения |
| Cache / Pub-Sub | Redis 7 | Сессии, очереди, pub/sub для WS |
| Queue | BullMQ | Фоновые задачи (диспетчинг, алерты, маршруты) |
| Real-time | WebSocket (ws) | GPS-трекинг, обновления статусов |
| Auth | JWT (access 15m + refresh 30d) | Stateless, безопасно |
| Validation | Zod | Единые схемы API + shared |
| Encryption | Node.js `crypto` (AES-256-GCM) | Шифрование PII получателей |
| Logging | Pino | Структурированные логи, производительность |

### Frontend — `apps/web`
| Компонент | Технология | Назначение |
|---|---|---|
| Framework | React 19 + TypeScript | SPA |
| Routing | React Router v7 | Страницы и лейауты по ролям |
| State | Zustand | Глобальное состояние (auth, алерты) |
| Server state | TanStack Query | Кэш API, инвалидация |
| HTTP | Axios | REST клиент |
| Maps | 2GIS MapGL | Карта курьеров, зоны, маршруты |
| UI base | shadcn/ui + Tailwind CSS | Компоненты, темизация |
| Dashboard UI | Tremor | KPI-карточки, графики метрик |
| Tables | TanStack Table | Сортировка, фильтры, пагинация |
| Charts | Recharts | Аналитика заказов и выплат |
| Forms | React Hook Form + Zod | Валидация (общие схемы с backend) |
| Real-time | WebSocket hook | GPS, статусы, алерты |
| PWA | vite-plugin-pwa | Установка на устройство, push, offline |

### Мобильное приложение курьера — `apps/courier-app`
| Компонент | Технология | Назначение |
|---|---|---|
| Framework | React Native + Expo SDK 52 | iOS + Android из одного кода |
| Navigation | React Navigation v7 | Tab + Stack навигация |
| State | Zustand | Заказы, смена, auth |
| Maps | React Native Maps + 2GIS | Навигация к точке |
| GPS | expo-location (background mode) | Трекинг даже при свёрнутом приложении |
| Camera | expo-camera | Фото при доставке, сканирование документов |
| Biometrics | expo-local-authentication | FaceID / TouchID для входа |
| Push | expo-notifications | Новый заказ, обновление маршрута |
| Offline | AsyncStorage + sync queue | Работа при потере связи |
| Build | EAS Build (Expo) | Облачная сборка без macOS для Android |
| OTA updates | EAS Update | Хотфиксы без App Store review |

### Инфраструктура
| Компонент | Технология |
|---|---|
| Контейнеризация | Docker + docker-compose |
| Reverse proxy | Nginx |
| CI/CD | GitHub Actions |
| VPS | Ubuntu 24.04 (62.217.178.173) |
| DB | PostgreSQL 16 (на VPS) |
| Cache | Redis 7 (на VPS) |

### Выбор ORM: Prisma vs Drizzle

| Критерий | Prisma 5 | Drizzle ORM |
|---|---|---|
| Типизация | Генерируется из `.prisma` схемы | TypeScript = схема (code-first, нет генерации) |
| Производительность | Собственный Rust-движок, overhead на сериализацию | Тонкая обёртка над `pg`, почти zero overhead |
| SQL контроль | Абстрагирует, raw через `$queryRaw` | Полный контроль, SQL-подобный API |
| Миграции | `prisma migrate` — автогенерация + история | `drizzle-kit` — аналогично, чуть проще |
| Bundle size | ~30MB (движок) | ~100KB |
| Edge / Serverless | Проблемы (Prisma Accelerate как костыль) | Нативная поддержка |
| Зрелость | 5+ лет, огромная экосистема | 2+ года, быстро растёт |
| Сложные JOIN | Неудобно (вложенные `include`) | Удобно (SQL-стиль) |

**Решение: Prisma на текущем этапе.** Обоснование:
1. Схема уже описана и синхронизирована с БД — переход сейчас = потеря времени
2. Наша нагрузка — транзакционные операции, не аналитика. Overhead Prisma незаметен при < 1000 RPS
3. `prisma db push` и `prisma migrate deploy` работают на VPS из коробки

**Технический долг:** при масштабировании свыше 1000 RPS или переходе на Edge-деплой — рассмотреть миграцию на Drizzle. Интерфейсы сервисов не изменятся, только реализация репозиториев.

### Shared package — `packages/shared`
- Zod-схемы (валидация DTO)
- TypeScript типы
- Утилиты (форматирование, константы)

---

## 3. Архитектура

```
┌──────────────────────────────────────────────────────────────┐
│                        CLIENTS                               │
│   Web App    Courier App    Client API    Public Tracking     │
└──────┬───────────┬──────────────┬──────────────┬────────────┘
       │           │              │              │
       └───────────┴──────────────┴──────────────┘
                           │ HTTPS / WSS
                    ┌──────▼──────┐
                    │    Nginx    │
                    └──────┬──────┘
                           │
              ┌────────────▼────────────┐
              │      Express API        │
              │  ┌─────────────────┐    │
              │  │   REST Routes   │    │
              │  │   WS Manager    │    │
              │  │   Middleware    │    │
              │  └────────┬────────┘    │
              │           │             │
              │  ┌────────▼────────┐    │
              │  │    Services     │    │
              │  │  (бизнес-логика)│    │
              │  └────────┬────────┘    │
              └───────────┼─────────────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
    ┌────▼────┐    ┌──────▼──────┐  ┌─────▼─────┐
    │Postgres │    │    Redis    │  │  BullMQ   │
    │   16    │    │  Cache/PubSub│  │  Queues   │
    └─────────┘    └─────────────┘  └─────┬─────┘
                                          │
                              ┌───────────▼──────────┐
                              │      Workers          │
                              │  DispatchWorker       │
                              │  AlertWorker          │
                              │  RouteWorker          │
                              │  NotificationWorker   │
                              └──────────────────────┘
```

### Очереди BullMQ

| Очередь | Назначение | Триггер |
|---|---|---|
| `dispatch` | Авто-назначение заказа курьеру | Создание заказа, истечение оффера |
| `dispatch-offer` | Отправка конкурентного предложения | Конкурентный режим |
| `alert` | Генерация алертов | Cron каждые 60 сек |
| `route` | Пересчёт маршрута курьера | Добавление заказа в маршрут |
| `notification` | Отправка SMS/WA/звонков получателю | Смена статуса заказа |
| `eta` | Обновление ETA по GPS | Обновление локации курьера |

---

## 4. Роли пользователей

| Роль | Кто | Возможности |
|---|---|---|
| `ADMIN` | Наш администратор платформы | Полный доступ: создание организаций, биллинг, глобальные настройки |
| `ORG_ADMIN` | Администратор компании-клиента | Настройка организации, зоны, склады, шаблоны, правила выплат |
| `SUPERVISOR` | Диспетчер/руководитель смены | Мониторинг карты, работа с алертами, ручное переназначение |
| `COURIER` | Курьер | Получение заказов, обновление статусов, GPS |
| `CLIENT` | API-интеграция компании-отправителя | Создание заказов, webhook-получение статусов |

---

## 5. Модули и сервисы

### 5.1 OrganizationService

**Назначение:** управление организациями на платформе.

**Методы:**
- `create(dto)` — создание организации + дефолтный `TenantConfig`
- `getById(id)` — профиль организации
- `updateConfig(orgId, dto)` — обновление feature flags и настроек
- `list(page, limit)` — список организаций (только ADMIN)
- `deactivate(orgId)` — деактивация (каскадно блокирует пользователей)

**API:**
```
POST   /api/organizations              ADMIN
GET    /api/organizations              ADMIN
GET    /api/organizations/:id          ADMIN, ORG_ADMIN
PATCH  /api/organizations/:id/config   ADMIN, ORG_ADMIN
DELETE /api/organizations/:id          ADMIN
```

---

### 5.2 AuthService

**Назначение:** аутентификация всех ролей.

**Методы:**
- `register(dto)` — регистрация + автосоздание Courier/Client профиля
- `login(dto)` → access token (15m) + refresh token (30d)
- `refresh(token)` → новая пара токенов
- `logout(token)` — инвалидация refresh token

**Особенности:**
- Access token содержит: `sub`, `role`, `organizationId`, `email`
- Refresh токены хранятся в БД (возможность инвалидации)
- При `isActive = false` — логин запрещён

---

### 5.3 CourierOnboardingService

**Назначение:** верификация документов курьера.

**Поток:**
```
UNSUBMITTED → [курьер подаёт документы] → PENDING
PENDING     → [ORG_ADMIN/SUPERVISOR одобряет] → APPROVED + verifiedAt = now()
PENDING     → [отклоняет с комментарием] → REJECTED
REJECTED    → [курьер исправляет и подаёт снова] → PENDING
```

**Методы:**
- `submitDocuments(userId, dto)` — паспорт серия/номер, фото, ИНН, фото ИНН
- `reviewDocuments(courierId, adminId, { approve, comment })`
- `getProfile(userId)` — профиль с текущим статусом
- `list(orgId, filters)` — список курьеров по статусу верификации

**Контрольные точки:**
- ✅ Паспорт: серия 4 цифры, номер 6 цифр
- ✅ ИНН: 12 цифр
- ✅ Повторная подача разрешена только при `REJECTED`
- ✅ Подача в статусе `APPROVED` — ошибка 409
- ✅ Назначение заказов только верифицированным курьерам (`verifiedAt IS NOT NULL`)

---

### 5.4 ZoneService

**Назначение:** управление зонами доставки, тарификация по зонам.

**Методы:**
- `create(orgId, dto)` — создание зоны с GeoJSON полигоном
- `findZoneForPoint(orgId, lat, lon)` — определение зоны для координат
- `calculateDeliveryPrice(zoneId, distanceKm)` — расчёт стоимости
- `list(orgId)`, `update(id, dto)`, `delete(id)`

**Логика определения зоны:**
```
Point-in-polygon алгоритм (ray casting).
Если точка попадает в несколько зон — выбирается зона с меньшим maxDeliveryMin.
Если зона не найдена — заказ создаётся без зоны, алерт супервизору.
```

**API:**
```
POST   /api/zones              ORG_ADMIN
GET    /api/zones              ORG_ADMIN, SUPERVISOR
PUT    /api/zones/:id          ORG_ADMIN
DELETE /api/zones/:id          ORG_ADMIN
GET    /api/zones/for-point?lat=&lon=   INTERNAL
```

---

### 5.5 WarehouseService & PickupPointService

**Назначение:** управление складами отгрузки и точками самовывоза.

**Warehouse:**
- Место откуда курьер забирает посылку
- Привязывается к смене курьера
- Адрес хранится зашифрованным (AES-256-GCM)

**PickupPoint:**
- Альтернативный адрес доставки (ПВЗ)
- Имеет расписание работы (`workingHours`)
- Привязывается к заказу при создании (если не курьерская доставка)

**API:**
```
CRUD /api/warehouses     ORG_ADMIN
CRUD /api/pickup-points  ORG_ADMIN
GET  /api/pickup-points/nearest?lat=&lon=&radius=   PUBLIC (для выбора ПВЗ)
```

---

### 5.6 ShiftService _(опциональный модуль)_

**Назначение:** управление рабочими сменами курьеров.

**Включается:** `TenantConfig.shiftsEnabled = true`

**Поток смены:**
```
SCHEDULED → [курьер открывает смену] → ACTIVE
ACTIVE    → [курьер закрывает] → COMPLETED
ACTIVE    → [супервизор отменяет] → CANCELLED
```

**Логика:**
- Если `shiftsEnabled = true`, курьер не получает заказы без активной смены
- При открытии смены: курьер указывает зону и склад (если включён модуль складов)
- При закрытии: автоматический расчёт итогов смены (кол-во заказов, км)

**Контрольные точки:**
- ✅ Нельзя открыть смену если уже есть активная
- ✅ Нельзя закрыть смену если есть незавершённые заказы
- ✅ Автозакрытие смены по расписанию (BullMQ delayed job)

**API:**
```
POST  /api/shifts              COURIER (открыть смену)
PATCH /api/shifts/:id/end      COURIER, SUPERVISOR (закрыть)
GET   /api/shifts              ORG_ADMIN, SUPERVISOR
GET   /api/shifts/active       SUPERVISOR (активные смены)
```

---

### 5.7 OrderService

**Назначение:** CRUD заказов, управление жизненным циклом.

**При создании заказа:**
1. Геокодирование адреса доставки (2GIS) → координаты
2. Определение зоны (`ZoneService.findZoneForPoint`)
3. Расчёт `slaDeadlineAt` = now + `TenantConfig.slaMinutes`
4. Шифрование `recipientName` + `recipientPhone` + `deliveryAddress`
5. Генерация `TrackingToken` (живёт 24ч)
6. Отправка события `ORDER_CREATED` в очередь `notification`
7. Отправка в очередь `dispatch`

**Статусная машина:**
```
CREATED   → ASSIGNED (диспетчинг)
ASSIGNED  → PICKED_UP (курьер забрал)
PICKED_UP → IN_TRANSIT (курьер в пути)
IN_TRANSIT → DELIVERED (доставлено + фото/подпись)
IN_TRANSIT → FAILED (не удалось доставить)
FAILED    → RETURNING (возврат на склад)
FAILED    → IN_TRANSIT (повторная попытка)
CREATED/ASSIGNED → CANCELLED (отмена)
```

**Контрольные точки:**
- ✅ Смена статуса только в разрешённых переходах
- ✅ `DELIVERED` требует `photoUrl` или `signatureUrl`
- ✅ Каждый переход пишет `OrderStatusEvent` с lat/lon
- ✅ Смена статуса → push в WS → событие в `notification` очередь
- ✅ SLA нарушение → `Alert` типа `ORDER_SLA_BREACH`

---

### 5.8 DispatchService

**Назначение:** назначение курьера на заказ. Два режима, переключаются через `TenantConfig.dispatchMode`.

#### Режим AUTO

```
1. Новый заказ попадает в очередь `dispatch`
2. DispatchWorker ищет подходящих курьеров:
   - verifiedAt IS NOT NULL
   - isOnline = true
   - (если shiftsEnabled) есть активная смена в нужной зоне
   - нет > N активных заказов (configurable)
   - расстояние от текущей позиции до pickupAddress ≤ autoDispatchRadiusKm
3. Сортировка: ближайший курьер первым
4. Назначение: Order.courierId = courierId, status → ASSIGNED
5. Push уведомление курьеру через WS
6. Если курьер не найден — повтор через 30 сек, после 3 попыток → Alert DISPATCH_FAILED
```

#### Режим COMPETITIVE

```
1. Новый заказ публикуется в пул (Redis SET per org)
2. Курьеры видят доступные заказы в своей зоне через WS/polling
3. Курьер нажимает "Взять" → DispatchOffer создаётся со статусом PENDING
4. Если первый — заказ назначается, остальные офферы → EXPIRED
5. DispatchOffer.expiresAt = now + competitiveOfferTimeoutSec
6. По истечению таймаута без принятия → заказ возвращается в пул
7. Если не взят за N минут → Alert DISPATCH_FAILED + можно переключить в AUTO
```

**Контрольные точки:**
- ✅ Курьер не получает заказ если не верифицирован
- ✅ Курьер не получает заказ если нет активной смены (при shiftsEnabled)
- ✅ Race condition при competitive: атомарный lock через Redis SETNX
- ✅ Один заказ не может быть назначен двум курьерам одновременно

---

### 5.9 RouteService (TSP)

**Назначение:** оптимизация маршрута курьера для минимизации пробега.

**Алгоритм:**
```
Входные данные:
  - Список заказов курьера на день (адреса доставки с координатами)
  - Начальная точка (склад или текущая позиция)

Шаг 1: Запрос Distance Matrix в 2GIS API
  POST https://routing.api.2gis.com/get_dist_matrix
  { sources: [...points], targets: [...points] }
  → матрица расстояний N×N (км)

Шаг 2: TSP решение
  - До 12 точек: точный алгоритм (dynamic programming, O(2^n · n²))
  - 12–30 точек: nearest neighbor + 2-opt улучшение (≈ 5-10 итераций)
  - > 30 точек: кластеризация по зонам, TSP внутри каждого кластера

Шаг 3: Запрос маршрута в 2GIS Directions API
  → polyline для отображения на карте
  → ETA для каждой точки

Шаг 4: Сохранение Route + RouteStop[] в БД
Шаг 5: Push маршрута курьеру через WS
```

**Триггеры пересчёта маршрута:**
- Добавление нового заказа курьеру
- Отмена заказа из маршрута
- Ручной запрос (курьер или супервизор)

**API:**
```
POST /api/routes/optimize           ORG_ADMIN, SUPERVISOR (пересчёт для курьера)
GET  /api/routes/:courierId/today   COURIER, SUPERVISOR
```

---

### 5.10 TrackingService (GPS)

**Назначение:** приём GPS-координат со смартфона курьера, трекинг в реальном времени, рассылка подписчикам.

#### Источник данных — смартфон курьера

Координаты поступают с мобильного приложения (React Native + Expo) двумя путями:

```
┌──────────────────────────────────────────────────────────────┐
│           СМАРТФОН КУРЬЕРА (React Native + Expo)             │
│                                                              │
│  expo-location (background mode)                             │
│  TaskManager.defineTask('BACKGROUND_LOCATION', handler)      │
│  timeInterval: 30 000 мс  |  distanceInterval: 50 м         │
└────────────┬──────────────────────┬──────────────────────────┘
             │                      │
    Приложение активно      Приложение свёрнуто
             │                      │
      WS send()              HTTP POST /api/tracking/location
   (постоянное соединение)  (надёжно на iOS — Apple убивает WS в фоне)
             │                      │
             └──────────┬───────────┘
                        ▼
              API Server (Express + WS)
```

**Ключевая особенность iOS:** WebSocket в фоне Apple закрывает через ~3 минуты. Поэтому background-трекинг использует HTTP, а WS — только пока приложение на экране.

**Разрешения:**
- iOS: `NSLocationAlwaysAndWhenInUseUsageDescription` → "Always Allow"
- Android: `ACCESS_FINE_LOCATION` + `ACCESS_BACKGROUND_LOCATION` + Foreground Service (показывает уведомление в шторке)

**Код TaskManager в courier-app:**
```typescript
TaskManager.defineTask('BACKGROUND_LOCATION', async ({ data }) => {
  const { latitude, longitude, speed, heading, accuracy } = data.locations[0].coords
  await fetch(`${API_URL}/api/tracking/location`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ lat: latitude, lon: longitude,
                           speed, heading, accuracy, timestamp: new Date() }),
  })
})

// Запуск при открытии смены
await Location.startLocationUpdatesAsync('BACKGROUND_LOCATION', {
  accuracy:          Location.Accuracy.Balanced,
  timeInterval:      30_000,
  distanceInterval:  50,
  foregroundService: {
    notificationTitle: 'Delivery — трекинг активен',
    notificationBody:  'Нажмите чтобы открыть приложение',
  },
})

// Остановка при закрытии смены / доставке последнего заказа
await Location.stopLocationUpdatesAsync('BACKGROUND_LOCATION')
```

**Экономия батареи:**

| Параметр | Активный заказ | Фон / ожидание |
|---|---|---|
| `accuracy` | `High` | `Balanced` |
| `timeInterval` | 15 сек | 30 сек |
| `distanceInterval` | 20 м | 50 м |

#### Поток обработки на сервере

```
Получен LocationUpdate (WS или HTTP POST):
  1. Courier.currentLat/Lon/lastSeenAt = обновить
  2. INSERT INTO location_logs
  3. Redis PUBLISH courier:{id} → фан-аут подписчикам
  4. WS push всем кто подписан на курьера (супервизор, публичный трекинг)
  5. Geofence проверка → GeoFenceEvent + Alert если вышел из зоны смены
  6. Пересчёт ETA (Haversine) → EtaSnapshot
  7. Если ETA ≤ 10 мин → триггер уведомления получателю
```

#### Redis Pub/Sub fan-out

```
Курьер А публикует позицию
  → Redis PUBLISH courier:A { lat, lon, speed, ts }
    ├── WS соединение супервизора (подписан на org)     → маркер на карте
    ├── WS соединение публичного трекинга (подписан на orderId) → маркер
    └── ETA Worker (подписан на активные заказы)        → пересчёт
```

**AlertWorker (каждые 60 сек, BullMQ repeatable job):**
```
Для каждой организации:
  CP-01: lastSeenAt < now − offlineThresholdMin    → Alert COURIER_OFFLINE (HIGH)
  CP-02: активный заказ + speed = 0 > stuckThreshold → Alert COURIER_STUCK (MEDIUM)
  CP-03: slaDeadlineAt < now()                     → Alert ORDER_SLA_BREACH (CRITICAL)
  CP-04: заказ CREATED без курьера > 15 мин        → Alert DISPATCH_FAILED (HIGH)
  CP-05: GeoFenceEvent за последний период          → Alert GEOFENCE_VIOLATION (MEDIUM)
```

**Публичный трекинг:**
- `GET /track/:token` — HTML страница с картой (без авторизации)
- Токен живёт 24ч, привязан к заказу
- Показывает: текущую позицию курьера + маршрут + ETA
- WS подписка на `courier:{courierId}` → обновления в реальном времени

---

### 5.11 AlertService

**Назначение:** генерация, хранение и разрешение алертов для супервизора.

**Dashboard супервизора** (WebSocket):
- Живая карта со всеми курьерами организации
- Очередь непрочитанных алертов (по severity: CRITICAL → LOW)
- Статус каждого активного заказа
- Алерты по клику открывают детали заказа/курьера

**Методы:**
- `create(orgId, type, severity, entityType, entityId, message, meta)`
- `resolve(alertId, supervisorId)` — закрытие алерта
- `list(orgId, { resolved, type, severity })` — список с фильтрами
- `getUnresolvedCount(orgId)` — счётчик для бейджа

**API:**
```
GET   /api/alerts                    SUPERVISOR, ORG_ADMIN
PATCH /api/alerts/:id/resolve        SUPERVISOR
GET   /api/alerts/count              SUPERVISOR (для бейджа)
```

---

### 5.12 RecipientCommunicationService

**Назначение:** автоматические уведомления получателю и ведение лога контактов.

**Шаблоны уведомлений** (настраиваются в `NotificationTemplate`):

| Событие | Канал по умолчанию | Пример текста |
|---|---|---|
| `ORDER_CREATED` | SMS | "Заказ №{number} принят. Отслеживайте: {trackingUrl}" |
| `COURIER_ASSIGNED` | SMS | "Ваш заказ №{number} передан курьеру {courierName}. ETA: {eta}" |
| `COURIER_NEARBY` | SMS | "Курьер в 10 минутах. Приготовьте место для получения." |
| `DELIVERED` | SMS + WA | "Заказ №{number} доставлен. Спасибо!" |
| `DELIVERY_FAILED` | CALL | Робозвонок: "Не удалось доставить. Нажмите 1 для переноса..." |

**Логика `COURIER_NEARBY`:**
```
ETA снизилась до ≤ 10 минут → NotificationWorker проверяет:
  - Уже отправлялся `COURIER_NEARBY` для этого заказа? → пропустить
  - Нет → отправить SMS + сохранить RecipientContact
```

**Провайдеры (настраиваются в TenantConfig):**
- SMS: SMSC.ru, SMS-центр, МТС Exolve
- WhatsApp: Edna, Green API
- Звонки: Voximplant, Манго Телеком

**Fallback:** SMS → WhatsApp → CALL при ошибке предыдущего.

**Контрольные точки:**
- ✅ Не отправлять повторно одно событие (дедупликация по `orderId + event`)
- ✅ Хранить `externalId` провайдера для трекинга статуса доставки
- ✅ Webhook от провайдера → обновление `RecipientContact.status`
- ✅ Не более 3 попыток отправки одного сообщения

---

### 5.13 PayoutService

**Назначение:** расчёт и управление выплатами курьерам.

**Логика расчёта:**
```
totalAmount = baseRate
            + (totalKm × kmRate)
            + (ordersCount × bonusPercentage / 100 × baseRate)
            - (lateOrders × penaltyPerLate)
```

**Поток:**
```
PENDING → [ORG_ADMIN запускает расчёт за период] → CALCULATED
CALCULATED → [ORG_ADMIN проверяет и одобряет] → APPROVED
APPROVED → [перевод выполнен] → PAID + paidAt = now()
```

---

### 5.14 EncryptionService

**Назначение:** шифрование PII получателей заказов.

**Что шифруется:**
- `Order.recipientNameEnc` — имя получателя
- `Order.recipientPhoneEnc` — телефон получателя
- `Order.deliveryAddress` (JSON) — адрес доставки

**Алгоритм:** AES-256-GCM
```
Шифрование:
  key = ENCRYPTION_KEY (32 байта из env, base64)
  iv  = crypto.randomBytes(12)
  cipher = createCipheriv('aes-256-gcm', key, iv)
  encrypted = cipher.update(plaintext) + cipher.final()
  authTag = cipher.getAuthTag()
  result = base64(iv + authTag + encrypted)  ← хранится в БД

Расшифровка:
  decoded = base64decode(stored)
  iv      = decoded.slice(0, 12)
  authTag = decoded.slice(12, 28)
  data    = decoded.slice(28)
  decipher = createDecipheriv(...)
  plaintext = decipher.update(data) + decipher.final()
```

**Ключ:** хранится в переменной окружения `ENCRYPTION_KEY`, не в БД. При ротации ключа — массовое перешифрование (отдельный скрипт).

---

## 6. Процессы и контрольные точки

### 6.1 Полный жизненный цикл заказа

```
[Клиент создаёт заказ через API]
  ↓
CP-01: Валидация DTO (Zod)
CP-02: Клиент принадлежит организации
CP-03: Геокодирование адреса доставки (2GIS)
CP-04: Определение зоны delivery address
CP-05: Шифрование PII получателя
CP-06: Генерация номера заказа (уникальный, human-readable)
CP-07: Расчёт slaDeadlineAt
CP-08: Создание TrackingToken
  ↓
[Заказ создан — статус CREATED]
  ↓
CP-09: SMS получателю: "Заказ принят" + ссылка на трекинг
CP-10: Webhook клиенту (если настроен)
  ↓
[Очередь dispatch]
  ↓
  ├── [AUTO] CP-11: Поиск ближайшего верифицированного онлайн-курьера в зоне
  │          CP-12: Redis lock на заказ (атомарность)
  │          CP-13: Назначение курьера, статус → ASSIGNED
  │          CP-14: Push WS курьеру "Новый заказ"
  │          CP-15: SMS получателю "Курьер назначен + ETA"
  │
  └── [COMPETITIVE] CP-11: Публикация заказа в Redis pool зоны
                    CP-12: WS рассылка курьерам в зоне
                    CP-13: Курьер принимает → Redis SETNX lock
                    CP-14: Статус → ASSIGNED, остальные офферы → EXPIRED
  ↓
[Курьер едет на склад / к отправителю]
  ↓
CP-16: Курьер нажимает "Забрал" → статус PICKED_UP + OrderStatusEvent (lat/lon)
CP-17: SMS получателю "Курьер забрал посылку"
  ↓
[Курьер едет к получателю — GPS трекинг активен]
  ↓
CP-18: GPS каждые N сек → LocationLog + WS fan-out
CP-19: ETA обновляется → EtaSnapshot
CP-20: ETA ≤ 10 мин → SMS "Курьер рядом"
CP-21: Geofence проверка — в зоне ли курьер
  ↓
[Курьер у получателя]
  ↓
  ├── [Успех] CP-22: Статус IN_TRANSIT → DELIVERED
  │          CP-23: Загрузка фото / подпись
  │          CP-24: SMS/WA получателю "Доставлено"
  │          CP-25: Webhook клиенту
  │          CP-26: totalOrders++ у курьера
  │
  └── [Неудача] CP-22: Статус → FAILED + комментарий
               CP-23: Робозвонок получателю
               CP-24: Супервизору — алерт для решения
               CP-25: Варианты: повтор / возврат / ПВЗ
```

### 6.2 Онбординг курьера

```
[Регистрация] → User создан, Courier создан (verificationStatus = UNSUBMITTED)
  ↓
CP-01: Курьер заполняет профиль (паспорт, ИНН, фото)
CP-02: Валидация: серия 4 цифры, номер 6 цифр, ИНН 12 цифр
CP-03: verificationStatus → PENDING
  ↓
[ORG_ADMIN/SUPERVISOR проверяет документы]
  ↓
  ├── [Одобрен] CP-04: verificationStatus → APPROVED, verifiedAt = now()
  │            CP-05: Push уведомление курьеру "Верификация пройдена"
  │            CP-06: Курьер может получать заказы
  │
  └── [Отклонён] CP-04: verificationStatus → REJECTED + comment
                CP-05: Push уведомление курьеру с причиной
                CP-06: Курьер исправляет и подаёт снова
```

### 6.3 Обработка алертов

```
[AlertWorker — каждые 60 сек]
  ↓
Проверки по организации:
  CP-01: Курьеры с lastSeenAt > offlineThresholdMin → Alert COURIER_OFFLINE (HIGH)
  CP-02: Курьеры с активным заказом и нет движения > stuckThresholdMin → Alert COURIER_STUCK (MEDIUM)
  CP-03: Заказы с slaDeadlineAt < now() → Alert ORDER_SLA_BREACH (CRITICAL)
  CP-04: Заказы без курьера > dispatchFailedThreshold → Alert DISPATCH_FAILED (HIGH)
  CP-05: GeoFenceEvent за последний период → Alert GEOFENCE_VIOLATION (MEDIUM)
  ↓
WS push супервизору (если подключён)
  ↓
[Супервизор видит алерт на дашборде]
  ↓
  ├── Ручное переназначение заказа
  ├── Звонок курьеру (из CRM)
  ├── Отмена / перенос заказа
  └── resolve(alertId) → Alert.resolvedAt = now()
```

### 6.4 Оптимизация маршрута

```
[Триггер: новый заказ назначен курьеру]
  ↓
CP-01: RouteWorker получает все активные заказы курьера
CP-02: Геокодирование адресов (2GIS Geocoding API)
CP-03: Запрос Distance Matrix (2GIS)
CP-04: TSP алгоритм (по кол-ву точек: DP / nearest-neighbor+2opt / кластеры)
CP-05: Запрос маршрута с упорядоченными точками (2GIS Directions API)
CP-06: Сохранение Route + RouteStop[] в БД
CP-07: Расчёт ETA для каждой точки
CP-08: WS push курьеру "Маршрут обновлён"
CP-09: EtaSnapshot для каждого заказа в маршруте
```

---

## 7. Безопасность и шифрование

### Аутентификация
- Access JWT: 15 минут, содержит `sub`, `role`, `organizationId`
- Refresh JWT: 30 дней, хранится в БД (возможность отзыва)
- Все endpoint'ы защищены `authenticate` middleware
- Авторизация по роли и `organizationId` (курьер не может видеть данные другой организации)

### Шифрование PII
- Алгоритм: AES-256-GCM (authenticated encryption)
- Ключ: `ENCRYPTION_KEY` (32 байта, base64) в переменных окружения
- Шифруются: имя получателя, телефон, адрес доставки
- В БД хранится: `base64(iv[12] + authTag[16] + ciphertext)`
- Расшифровка только на уровне сервиса, не выходит в логи

### Изоляция тенантов
- Каждый запрос проверяет `req.user.organizationId === resource.organizationId`
- Middleware `requireSameOrg` применяется ко всем resource-endpoints
- ADMIN платформы не ограничен организацией

### Rate limiting
- `/api/auth/*`: 10 req/min per IP
- `/api/orders` (POST): 100 req/min per Client
- WebSocket: 1 location update / gpsIntervalSec per courier

### Безопасность API ключей интеграций
- API ключи провайдеров (SMS, WA, звонки) хранятся зашифрованными в `TenantConfig`
- Шифрование: тот же AES-256-GCM EncryptionService

---

## 8. Интеграции

### 8.1 2GIS API

| Endpoint | Использование |
|---|---|
| Geocoding API | Адрес → координаты при создании заказа |
| Distance Matrix API | Матрица расстояний для TSP |
| Directions API | Маршрут с polyline и ETA |

**Конфигурация:** `TenantConfig.twoGisApiKey` (каждая организация со своим ключом или платформенный ключ)

**Rate limits:** соблюдать лимиты 2GIS, кэшировать результаты геокодирования в Redis (TTL 7 дней) по ключу `geo:{address_hash}`.

### 8.2 SMS провайдеры

**Поддерживаемые:** SMSC.ru, МТС Exolve, СМС-центр

**Абстракция:** `SmsProvider` интерфейс:
```typescript
interface SmsProvider {
  send(phone: string, text: string): Promise<{ externalId: string }>
  getStatus(externalId: string): Promise<ContactStatus>
}
```

Webhook от провайдера на `POST /api/webhooks/sms/:provider` → обновление `RecipientContact.status`

### 8.3 WhatsApp / Telegram

- **Green API** (WhatsApp): простая интеграция, webhooks
- **Telegram Bot API**: для организаций с Telegram-ботом

### 8.4 Голосовые звонки

- **Voximplant**: сценарии робозвонка (XML), статистика
- **Манго Телеком**: запись разговоров, `recordingUrl` в `RecipientContact`

### 8.5 Webhook клиентам (компании-отправители)

При смене статуса заказа:
```json
POST {webhookUrl}
{
  "event": "ORDER_STATUS_CHANGED",
  "orderId": "...",
  "externalId": "...",
  "status": "DELIVERED",
  "timestamp": "2026-04-26T10:00:00Z"
}
```
Retry: 3 попытки с экспоненциальным backoff (1m, 5m, 30m).

---

## 9. Нефункциональные требования

| Параметр | Требование |
|---|---|
| API latency (p95) | < 200ms |
| WS latency (GPS update) | < 100ms |
| Доступность | 99.5% |
| Заказов в сутки | до 10 000 на организацию |
| Одновременных WS соединений | до 500 |
| Хранение LocationLog | 90 дней, потом архив |
| Хранение AuditLog | 1 год |

---

## 10. Порядок реализации

### Фаза 1 — Ядро (выполнено частично)
- [x] Prisma схема
- [x] База данных на VPS
- [x] AuthService (register, login, refresh, logout)
- [x] Courier onboarding (submitDocuments, reviewDocuments)
- [ ] OrganizationService
- [ ] EncryptionService
- [ ] OrderService (CRUD, статусная машина)

### Фаза 2 — Диспетчинг
- [ ] ZoneService (зоны + point-in-polygon)
- [ ] DispatchService AUTO режим
- [ ] DispatchService COMPETITIVE режим
- [ ] BullMQ workers: dispatch, dispatch-offer

### Фаза 3 — Трекинг и мониторинг
- [ ] TrackingService (GPS, LocationLog, ETA)
- [ ] AlertWorker (генерация алертов по расписанию)
- [ ] AlertService (API для супервизора)
- [ ] Supervisor WebSocket dashboard
- [ ] GeoFence события

### Фаза 4 — Маршрутизация
- [ ] 2GIS интеграция (Geocoding, Distance Matrix, Directions)
- [ ] TSP алгоритм (DP + nearest-neighbor + 2-opt)
- [ ] RouteService + RouteWorker
- [ ] PublicTrackingService (страница /track/:token)

### Фаза 5 — Коммуникации
- [ ] NotificationTemplate CRUD
- [ ] RecipientCommunicationService
- [ ] SMS провайдер (SMSC.ru)
- [ ] WhatsApp провайдер (Green API)
- [ ] Голосовые звонки (Voximplant)
- [ ] Webhook клиентам

### Фаза 6 — Склады и смены
- [ ] WarehouseService
- [ ] PickupPointService
- [ ] ShiftService (опциональный модуль)

### Фаза 7 — Финансы и аналитика
- [ ] PayoutService (расчёт выплат)
- [ ] Отчёты для ORG_ADMIN (заказы, эффективность, выплаты)

### Фаза 8 — Frontend Web
- [ ] ORG_ADMIN кабинет (настройки, зоны, склады, курьеры, правила выплат)
- [ ] SUPERVISOR dashboard (карта, алерты, live-заказы)
- [ ] CLIENT кабинет (создание заказов, история, отчёты)
- [ ] Courier onboarding форма (верификация документов)
- [ ] Public: /track/:token страница трекинга

### Фаза 9 — Courier Mobile App
- [ ] Аутентификация + биометрия
- [ ] Экран активного заказа + навигация (2GIS)
- [ ] Список заказов + конкурентный приём
- [ ] Экран смены (открыть / закрыть)
- [ ] Фото при доставке + подпись
- [ ] Профиль + загрузка документов (верификация)
- [ ] Background GPS + offline-режим
- [ ] EAS Build + публикация в App Store / Google Play

---

## UI и адаптивность

### Матрица устройств по ролям

| Роль | Desktop | Планшет | Смартфон | PWA |
|---|---|---|---|---|
| `ORG_ADMIN` | ✅ Полный функционал | ✅ Основные разделы | ⚠️ Просмотр статистики, алерты | ✅ |
| `SUPERVISOR` | ✅ Карта + алерты | ✅ Основной рабочий сценарий | ✅ Алерты + статус курьеров | ✅ |
| `CLIENT` | ✅ Полный функционал | ✅ Заказы + отслеживание | ✅ Создание заказа + статус | ✅ |
| `COURIER` | — | ⚠️ Через браузер (запасной) | ✅ Нативное приложение | — |
| Публичный трекинг | ✅ | ✅ | ✅ Mobile-first | — |

### Breakpoints (Tailwind)

```
sm:   640px  — смартфон landscape / маленький планшет
md:   768px  — планшет portrait
lg:  1024px  — планшет landscape / небольшой desktop
xl:  1280px  — desktop
2xl: 1536px  — широкий desktop
```

### Поведение по ролям

**ORG_ADMIN** — desktop-first:
- Sidebar навигация (desktop/tablet) → bottom tab bar (mobile)
- Таблицы → card-list на мобильном
- Редактирование зон (полигоны на карте) — только desktop/tablet
- Отчёты с графиками → упрощённые KPI-карточки на мобильном

**SUPERVISOR** — tablet = desktop (равноценно):
- Desktop/tablet landscape: карта 70% + панель алертов 30% (side-by-side)
- Tablet portrait: карта сверху + алерты снизу (resizable)
- Mobile: таб-навигация "Карта" / "Алерты" / "Заказы"
- Сценарий: iPad на складе или в диспетчерской — полноценная работа

**CLIENT** — смартфон полноценный:
- Создание заказа: wizard из 3 шагов (адрес → получатель → подтверждение)
- История заказов: card-список с pull-to-refresh
- Быстрый повтор последнего заказа — одна кнопка
- Push через PWA (Web Push API) — без App Store
- Offline: последние 50 заказов кэшированы

### UI библиотеки — обоснование выбора

**shadcn/ui** — основа:
- Компоненты живут в проекте (не зависимость) — полная кастомизация
- Radix UI под капотом — доступность из коробки
- Tailwind — единый стиль с мобильным (если RN + NativeWind)
- Тёмная тема без дополнительных пакетов

**Tremor** — dashboard-специфичные компоненты:
- KPI карточки, sparklines, area charts
- Готовые паттерны для метрик (заказы/день, процент доставки)

**TanStack Table** — таблицы данных:
- Виртуализация строк (тысячи заказов без лагов)
- Сортировка, фильтры, группировка на стороне клиента

**2GIS MapGL** — карта:
- Лучшее покрытие по России/СНГ
- Слои: курьеры, маршруты, зоны (GeoJSON полигоны)
- Кластеризация маркеров при zoom-out

### Дизайн-система

```
Типографика:  Inter (системный шрифт, zero-loading)
Цвета:
  primary:    blue-600   — основные действия
  success:    green-500  — DELIVERED, верифицирован
  warning:    amber-500  — PENDING, предупреждения
  danger:     red-500    — FAILED, CRITICAL алерты
  neutral:    zinc-*     — фоны, границы, текст

Темы:         light (default) + dark (для ночных смен)
Плотность:    default (admin) / compact (supervisor dashboard)
Иконки:       lucide-react
```

### Layouts по ролям

#### ORG_ADMIN — Icon Sidebar (паттерн: Linear / Vercel / Supabase)

```
┌──────────────────────────────────────────────────────┐
│  🚚 Delivery  [org name ▾]               [avatar]    │  64px header
├──────────┬───────────────────────────────────────────┤
│ 📊       │  Breadcrumb > Подраздел                   │
│ 👤       │───────────────────────────────────────────│
│ 📦       │                                           │
│ 🗺️        │            CONTENT AREA                   │
│ 🏭       │     (таблицы, формы, карточки)            │
│ ⚙️        │                                           │
│ ──────── │                                           │
│ 👤       │                                           │
└──────────┴───────────────────────────────────────────┘
 64px (иконки) / 240px (expand по hover)
```

Секции: Dashboard · Курьеры · Заказы · Зоны · Склады/ПВЗ · Настройки  
Планшет: sidebar всегда свёрнут (иконки), expand → drawer поверх контента  
Мобильный: bottom navigation bar (5 вкладок + "Ещё")

#### SUPERVISOR — Map-first (карта — главный элемент)

```
┌──────────────────────────────────────────────────────┐
│  [≡]  SUPERVISOR      🔴 3 алерта   12:34  [avatar]  │  56px topbar
├────────────────────────────────┬─────────────────────┤
│                                │ АЛЕРТЫ              │
│                                │ 🔴 SLA #1234        │
│          2GIS MAP              │ 🟡 Stuck Иванов     │
│   (курьеры, маршруты, зоны)    │─────────────────────│
│                                │ АКТИВНЫЕ ЗАКАЗЫ     │
│   [фильтры]  [слои]            │ #1234  ●──────○     │
│                                │ #1235  ●───○        │
└────────────────────────────────┴─────────────────────┘
         MAP flex-1                   Panel 320px (resizable)
```

Клик на курьера → bottom sheet с деталями (без смены страницы)  
Клик на алерт → карта центрируется на проблемной точке  
Планшет portrait: карта сверху, алерты → drawer снизу (50%)  
Мобильный: bottom tabs "Карта" / "Алерты🔴" / "Заказы"

#### CLIENT — Wizard + History

```
Desktop/Tablet:                         Mobile (wizard):
┌──────────────────────────────┐        ┌─────────────────┐
│ 🚚  [Новый заказ]  [avatar]  │        │  ←  Новый заказ │
├────────────┬─────────────────┤        │  ●──○──○        │
│ Новый заказ│                 │        ├─────────────────┤
│ История    │   CONTENT       │        │  Откуда:        │
│ Отчёты     │                 │        │  [____________] │
│ Настройки  │                 │        │  Куда:          │
└────────────┴─────────────────┘        │  [____________] │
                                        ├─────────────────┤
                                        │  [   Далее →  ] │
                                        └─────────────────┘
```

Wizard: 4 шага — Адреса → Получатель → Параметры → Подтверждение  
Быстрый повтор последнего заказа — одна кнопка на главном экране

#### Public Tracking — /track/:token (mobile-first, no auth)

```
┌─────────────────┐
│  🚚  Доставка   │
│  Заказ #1234    │
├─────────────────┤
│   [ 2GIS MAP ]  │  курьер + маршрут
├─────────────────┤
│  ● В пути       │
│  Прибытие ~14 мин│
│  Иван К.  ★4.9  │
├─────────────────┤
│ [Позвонить курьеру] │
└─────────────────┘
```

Никакой навигации, никакого login. Только карта + статус + ETA + кнопка звонка.

#### Общий элемент: Command Palette (Cmd+K)

Для SUPERVISOR и ORG_ADMIN — быстрый поиск заказа/курьера/раздела.  
Реализация: `cmdk` (встроен в shadcn). Особенно критично для супервизора.

#### Архитектура layouts в коде

```tsx
// layouts/DashboardLayout.tsx   — ORG_ADMIN, CLIENT
// layouts/SupervisorLayout.tsx  — SUPERVISOR (map-first)
// layouts/PublicLayout.tsx      — /track/:token

<Route element={<DashboardLayout />}>
  <Route path="/admin/*"      element={<OrgAdminRoutes />} />
  <Route path="/client/*"     element={<ClientRoutes />} />
</Route>
<Route element={<SupervisorLayout />}>
  <Route path="/supervisor/*" element={<SupervisorRoutes />} />
</Route>
<Route element={<PublicLayout />}>
  <Route path="/track/:token" element={<TrackingPage />} />
</Route>
```

### Структура `apps/web`

```
src/
  pages/
    auth/              ← /login
    org-admin/         ← /admin/* — зоны, склады, курьеры, настройки
    supervisor/        ← /supervisor/* — карта, алерты, заказы
    client/            ← /client/* — создание заказов, история
    track/             ← /track/:token — публичный трекинг
  components/
    map/               ← CourierMarker, RoutePolyline, ZoneLayer
    orders/            ← OrderCard, StatusBadge, StatusTimeline
    alerts/            ← AlertFeed, AlertBadge, AlertDrawer
    courier/           ← CourierCard, VerificationStatus
    shared/            ← shadcn компоненты (re-export + кастомизация)
  layouts/
    DashboardLayout    ← sidebar + header + breadcrumbs
    MapLayout          ← fullscreen map + floating panels
    PublicLayout       ← минималистичный (для /track)
  hooks/
    useWebSocket       ← GPS и статусы в реальном времени
    useAlerts          ← подписка на алерты супервизора
  stores/
    auth.store         ← user, token, org
    alerts.store       ← непрочитанные алерты
```

---

## Переменные окружения

```env
# Database
DATABASE_URL=postgres://user:pass@host/delivery_db

# Auth
JWT_SECRET=...
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=...

# Encryption
ENCRYPTION_KEY=<32 байта base64>

# Redis
REDIS_URL=redis://localhost:6379

# 2GIS (платформенный ключ по умолчанию)
TWOGIS_API_KEY=...

# App
PORT=3000
NODE_ENV=production
ALLOWED_ORIGINS=https://app.delivery.ru
```
