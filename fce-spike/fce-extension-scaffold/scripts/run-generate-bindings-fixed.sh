#!/bin/bash
set -x
cd "$(dirname "$0")/.."
export PATH="$HOME/sdk/go/bin:$HOME/.foundry/bin:/c/Users/USER/Desktop/Warden/fce-spike/tools-win:$PATH"
which jq
which go
which forge
./scripts/generate-bindings.sh
