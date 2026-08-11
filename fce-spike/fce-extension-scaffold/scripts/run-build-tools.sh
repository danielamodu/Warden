#!/bin/bash
set -x
cd "$(dirname "$0")/../tools"
export PATH="$HOME/.foundry/bin:$HOME/sdk/go/bin:$PATH"
go build ./...
