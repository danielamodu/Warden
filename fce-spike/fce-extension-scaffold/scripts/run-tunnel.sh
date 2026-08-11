#!/bin/bash
set -x
cd "$(dirname "$0")/.."
docker compose -f docker-compose.cloudflared.yaml up -d
sleep 5
URL=$(docker compose -f docker-compose.cloudflared.yaml logs cloudflared \
      | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | tail -1)
echo "TUNNEL_URL=$URL"
if [ -z "$URL" ]; then
  echo "No URL found yet, waiting longer..."
  sleep 10
  URL=$(docker compose -f docker-compose.cloudflared.yaml logs cloudflared \
        | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | tail -1)
  echo "TUNNEL_URL=$URL"
fi
