#!/usr/bin/env bash
# Audit console.* usage in app code (see CONTRIBUTING.md § Logging).
# Usage: ./scripts/audit-console.sh
# Output: list of file:line for console.log/warn/error/debug/info

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

rg "console\.(log|warn|error|debug|info)" app/ server.ts worker.ts --no-heading -n 2>/dev/null || true
