#!/bin/bash
set -x
cd "$(dirname "$0")/../tools"
export PATH="$HOME/.foundry/bin:$HOME/sdk/go/bin:$PATH"
go run ./cmd/query-tee -reg 0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE -ext 66120 0xCCbc7fef9A0710ED0FB1238acD3D505aF964E09b 0x33c2f5f41Bf1199A7Dc68F32D74ED097F07e33C0
