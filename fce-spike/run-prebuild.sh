#!/usr/bin/env bash
set -e
export PATH="/c/Users/USER/Desktop/Warden/fce-spike/tools-win/foundry:/c/Users/USER/Desktop/Warden/fce-spike/tools-win/go/bin:/c/Users/USER/Desktop/Warden/fce-spike/tools-win:$PATH"
cd "/c/Users/USER/Desktop/Warden/fce-spike/fce-extension-scaffold"
bash ./scripts/use-chain.sh coston2
cat .env
echo "=== pre-build.sh ==="
bash ./scripts/pre-build.sh
echo "=== extension.env ==="
cat config/extension.env
