#!/usr/bin/env bash
export PATH="/home/xbt/.foundry/bin:/usr/local/bin:/usr/local/sbin:/usr/bin:/usr/sbin:/bin:/sbin:$PATH"
echo "--- forge ---"
forge --version
echo "--- uname ---"
uname -m
echo "--- distro ---"
cat /etc/os-release | head -5
echo "--- docker (from wsl) ---"
command -v docker || echo "docker MISSING in WSL PATH"
docker info >/dev/null 2>&1 && echo "docker engine reachable from WSL" || echo "docker engine NOT reachable from WSL"
echo "--- go ---"
command -v go || echo "go MISSING"
echo "--- ngrok ---"
command -v ngrok || echo "ngrok MISSING"
echo "--- git ---"
git --version
