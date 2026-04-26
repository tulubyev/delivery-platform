#!/usr/bin/env bash
# Первичная настройка VPS Beget Ubuntu — запускать от root: bash setup-vps.sh
set -euo pipefail

APP_DIR="/opt/delivery-platform"
REPO_URL="https://github.com/YOUR_USERNAME/delivery-platform.git"

echo "==> Updating system..."
apt-get update -qq && apt-get upgrade -y -qq

if ! command -v docker &>/dev/null; then
  echo "==> Installing Docker..."
  curl -fsSL https://get.docker.com | bash
  systemctl enable docker && systemctl start docker
fi

apt-get install -y docker-compose-plugin git curl

if [ ! -d "$APP_DIR" ]; then
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
[ ! -f ".env" ] && cp .env.example .env && echo "⚠️  Заполните .env: nano $APP_DIR/.env"

if command -v ufw &>/dev/null; then
  ufw --force reset
  ufw default deny incoming && ufw default allow outgoing
  ufw allow ssh && ufw allow 80/tcp && ufw allow 443/tcp
  ufw --force enable
fi

if [ ! -f ~/.ssh/deploy_key ]; then
  ssh-keygen -t ed25519 -C "deploy@delivery-vps" -f ~/.ssh/deploy_key -N ""
  echo "📋 Публичный ключ для GitHub Deploy Keys:"
  cat ~/.ssh/deploy_key.pub
fi

echo ""
echo "✅ Setup complete!"
echo "   1. nano $APP_DIR/.env"
echo "   2. cd $APP_DIR && docker compose up -d"
echo "   3. docker compose exec api npx prisma migrate deploy"
echo ""
echo "GitHub Secrets: VPS_HOST, VPS_USER, VPS_SSH_KEY"
