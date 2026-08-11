#!/usr/bin/env bash
export PATH="/c/Users/USER/Desktop/Warden/fce-spike/tools-win/foundry:/c/Users/USER/Desktop/Warden/fce-spike/tools-win/go/bin:/c/Users/USER/Desktop/Warden/fce-spike/tools-win:/c/Program Files/Docker/Docker/resources/bin:$PATH"
cd "/c/Users/USER/Desktop/Warden/fce-spike/fce-extension-scaffold"
echo "=== docker compose version ==="
docker compose version
echo "=== start-services.sh --chain coston2 ==="
bash ./scripts/start-services.sh --chain coston2
