#!/bin/bash
set -e
echo "--- installing foundryup ---"
curl -L https://foundry.paradigm.xyz | bash
echo "--- running foundryup ---"
export PATH="$HOME/.foundry/bin:$PATH"
foundryup
echo "--- versions ---"
cast --version
forge --version
