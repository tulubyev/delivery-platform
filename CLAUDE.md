# CLAUDE.md — LastMiles

Платформа доставки последней мили

## Где что лежит

| | |
|---|---|
| GitHub | https://github.com/tulubyev/delivery-platform |
| Локально | `~/Dropbox/DEV/Delivery` |
| VPS | `/var/www/lastmiles` (90.156.168.149) |
| Прод | lastmiles.ru |
| Стек | pnpm-монорепо — Express + Prisma + BullMQ, React/Vite, Expo |

## Как ведётся работа

Проект подключён к общей доске **DEV Control** (реестр — `tulubyev/dev-control`).

- Работа идёт по issues этого репозитория. Перед началом проверь, есть ли задача:
  `gh issue list --label agent:claude` — задачи, назначенные Claude.
- Каждая задача делается в отдельной ветке (`feat/<номер>-кратко`, `fix/<номер>-кратко`)
  и завершается PR с `Closes #<номер>` в описании — тогда карточка на доске сама
  уйдёт в Done после merge.
- Если задача заблокирована (нужен ответ, доступ, решение) — комментарий в issue
  с вопросом и метка `blocked`, не гадать.
- В PR: что сделано, как проверено, что осталось.
- Секреты только в `.env` (в git не попадают), в `.env.example` — имена переменных.

## Команды

Установка и локальный запуск (нужен `.env` по образцу `.env.example`):

```bash
pnpm install
pnpm --filter @delivery/shared build      # shared собирается первым, иначе tsc не видит @delivery/shared
pnpm --filter api exec prisma generate    # после установки и после правок schema.prisma
pnpm dev:api                              # API
pnpm dev:web                              # web (Vite)
```

Проверка типов (тестов в проекте нет, `lint` = `tsc --noEmit`):

```bash
pnpm lint
```

База данных:

```bash
pnpm db:migrate                           # dev-миграции
pnpm --filter api db:migrate:prod         # prisma migrate deploy (на проде делает контейнер сам)
pnpm --filter api db:seed                 # сид
```

Деплой на VPS (`/var/www/lastmiles`, пользователь с sudo):

```bash
cd /var/www/lastmiles && sudo git pull --ff-only origin main
sudo docker compose up -d --build api                                  # API: пересборка и пересоздание контейнера
sudo pnpm --filter @delivery/shared build && sudo pnpm --filter web build   # фронт: dist раздаёт nginx, рестарт не нужен
```

Заметки по инфраструктуре:

- Фронт: nginx на хосте, `root /var/www/lastmiles/apps/web/dist`, порт 8080. Перед ним Traefik.
- API: контейнер `delivery-api` в сети `traefik-public`. Маршрут `api.lastmiles.ru` задан Docker labels в `docker-compose.yml` (стандарт `vps-server-infra`, `docs/NEW-PROJECT.md`, Вариант A) и пока дублируется файловым маршрутом `lastmiles-api` в `traefik/dynamic.yml` репозитория `vps-server-infra` (на `http://delivery-api:3000`). Дубль нужно убрать после проверки labels. Порт на хосте не публикуется.
- CI (`.github/workflows`): `ci.yml` — проверка типов и пробная сборка Docker-образов API и web (без публикации) на каждый PR и push в `main`; `mobile-eas.yml` — сборка APK через EAS, только ручной запуск (мобильное приложение пока не в работе; нужен проект Expo вместо `YOUR_EAS_PROJECT_ID` в `apps/mobile/app.json`). Автодеплоя нет: выкатка делается вручную по шагам выше.
- Миграции применяются автоматически: при старте контейнер API выполняет `prisma migrate deploy`, затем `node dist/app.js`. Если миграция падает, ошибка уходит в лог контейнера, а API всё равно стартует.
- Вход защищён капчей Aptogon: нужен `APTOGON_SECRET_KEY` в `.env`, отключить можно `CAPTCHA_ENABLED=false`.
