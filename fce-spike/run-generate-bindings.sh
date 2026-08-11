#!/usr/bin/env bash
set -e
export PATH="/c/Users/USER/Desktop/Warden/fce-spike/tools-win/foundry:/c/Users/USER/Desktop/Warden/fce-spike/tools-win/go/bin:/c/Users/USER/Desktop/Warden/fce-spike/tools-win:$PATH"
cd "/c/Users/USER/Desktop/Warden/fce-spike/fce-extension-scaffold"
echo "forge: $(forge --version | head -1)"
echo "go: $(go version)"
./scripts/generate-bindings.sh
