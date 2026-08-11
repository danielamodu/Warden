#!/usr/bin/env bash
set -e
export PATH="/c/Users/USER/Desktop/Warden/fce-spike/tools-win/foundry:/c/Users/USER/Desktop/Warden/fce-spike/tools-win/go/bin:/c/Users/USER/Desktop/Warden/fce-spike/tools-win:$PATH"
cd "/c/Users/USER/Desktop/Warden/fce-spike/fce-extension-scaffold"
echo "=== go build ./... (extension) ==="
(cd go && go build ./... && echo OK)
echo "=== go vet ./... (extension) ==="
(cd go && go vet ./... && echo OK)
echo "=== go test ./... -v (extension) ==="
(cd go && go test ./... -v)
echo "=== go build ./... (tools) ==="
(cd tools && go build ./... && echo OK)
