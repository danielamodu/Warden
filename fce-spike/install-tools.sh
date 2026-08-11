#!/usr/bin/env bash
set -e
export PATH="/home/xbt/.foundry/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
mkdir -p "$HOME/wardentools"
cd "$HOME/wardentools"

if ! command -v go >/dev/null 2>&1 && [ ! -d "$HOME/wardentools/go" ]; then
  echo "Installing Go..."
  curl -fsSL -o go.tar.gz https://go.dev/dl/go1.25.4.linux-amd64.tar.gz
  tar -xzf go.tar.gz
  rm go.tar.gz
  echo "Go extracted to $HOME/wardentools/go"
else
  echo "Go already present, skipping"
fi

if ! command -v ngrok >/dev/null 2>&1 && [ ! -f "$HOME/wardentools/ngrok" ]; then
  echo "Installing ngrok..."
  curl -fsSL -o ngrok.tgz https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
  tar -xzf ngrok.tgz
  rm ngrok.tgz
  echo "ngrok extracted to $HOME/wardentools/ngrok"
else
  echo "ngrok already present, skipping"
fi

# Make PATH additions durable for future interactive shells too.
MARKER="# added by warden fce-spike setup"
if ! grep -qF "$MARKER" "$HOME/.bashrc" 2>/dev/null; then
  {
    echo "$MARKER"
    echo 'export PATH="$HOME/wardentools/go/bin:$HOME/wardentools:$HOME/.foundry/bin:$PATH"'
  } >> "$HOME/.bashrc"
fi

export PATH="$HOME/wardentools/go/bin:$HOME/wardentools:$HOME/.foundry/bin:$PATH"
echo "--- versions ---"
go version || echo "go still missing"
ngrok version || echo "ngrok still missing"
forge --version || echo "forge still missing"
