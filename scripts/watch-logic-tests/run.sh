#!/usr/bin/env bash
# Builds the watch app's pure logic with its tests and runs them.
#   SWIFTC=/path/to/swiftc scripts/watch-logic-tests/run.sh [--write-ops]
# Any Swift 5.9+ toolchain works, including Linux (swift.org downloads).
set -euo pipefail
cd "$(dirname "$0")/../.."
SWIFTC="${SWIFTC:-swiftc}"
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT
"$SWIFTC" -swift-version 5 -warnings-as-errors \
  targets/watch/Models.swift targets/watch/Logbook.swift scripts/watch-logic-tests/main.swift \
  -o "$out/watch-logic-tests"
"$out/watch-logic-tests" src/lib/__tests__/fixtures "$@"
