#!/bin/bash
# Первоначальная настройка VPS (Ubuntu 22.04)
# Запускать от root: bash server-setup.sh
set -e

DOMAIN=${1:-"lastmiles.ru"}
API_DOMAIN="api.${DOMAIN}"
EMAIL=${2:-"admin@lastmiles.ru"}

echo "=== Delivery Platform Server Setup ==="
echo "Domain: $DOMAIN | API: $API_DOMAIN | Email: $EMAIL"

# ── Зависимости ───────────────────────────────────────────────────────────
apt-get update -qq
apt-get install -y -qq curl git ufw fail2ban

# Docker
if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
fi
docker compose version || apt-get install -y docker-compose-plugin

# ── Firewall ──────────────────────────────────────────────────────────────
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# ── Директории ───────────────────────────────────────────────────────────
mkdir -p /opt/delivery-platform
cd /opt/delivery-platform

# Клонируем если ещё не было
if [ ! -d ".git" ]; then
    git clone https://github.com/tulubyev/delivery-platform.git .
fi

# ── .env ──────────────────────────────────────────────────────────────────
if [ ! -f ".env" ]; then
    cp .env.example .env 2>/dev/null || cat > .env << 'ENVEOF'
DATABASE_URL=postgres://delivery:CHANGE_ME@62.217.178.173/delivery_db
REDIS_URL=redis://redis:6379
JWT_SECRET=CHANGE_ME_LONG_RANDOM_SECRET_32CHARS
JWT_REFRESH_SECRET=CHANGE_ME_ANOTHER_LONG_SECRET_32CHARS
TWOGIS_API_KEY=64f6d525-6034-41b1-a908-b8bd7ab9d887
SMSRU_API_ID=4DF65B23-2F46-3E1C-9270-FFA6778EF253
EXPO_PUBLIC_PROJECT_ID=YOUR_EAS_PROJECT_ID
YOOKASSA_SHOP_ID=your_shop_id
YOOKASSA_SECRET_KEY=your_secret_key
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
ALLOWED_ORIGINS=https://lastmiles.ru
PORT=3000
NODE_ENV=production
ENVEOF
    echo "⚠  Заполните .env перед запуском!"
fi

# ── TLS (Let's Encrypt) ───────────────────────────────────────────────────
echo "=== Получение TLS-сертификатов ==="
docker run --rm \
    -v /opt/delivery-platform/nginx/certbot_webroot:/var/www/certbot \
    -v /opt/delivery-platform/nginx/certbot_certs:/etc/letsencrypt \
    -p 80:80 \
    certbot/certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    -d "$DOMAIN" \
    -d "$API_DOMAIN" || echo "⚠ Certbot пропущен — проверьте DNS"

# ── Сборка и запуск ───────────────────────────────────────────────────────
echo "=== Сборка Docker образов ==="
docker compose build

echo "=== Запуск ==="
docker compose up -d

echo ""
echo "✅ Готово!"
echo "   Web:    https://$DOMAIN"
echo "   API:    https://$API_DOMAIN"
echo "   Health: https://$API_DOMAIN/health"
