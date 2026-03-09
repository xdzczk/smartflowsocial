#!/usr/bin/env bash
# Audit explicit any and unsafe casts for type-safety backlog (see CONTRIBUTING.md § Type safety).
# Usage: ./scripts/audit-any.sh [app|tests|all]
# Output: file:line:match

set -e
SCOPE="${1:-app}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PATTERN=": any\\b|as any\\b|as unknown as"
if [[ "$SCOPE" == "all" ]]; then
  rg -n "$PATTERN" app/ tests/ --no-heading 2>/dev/null || true
elif [[ "$SCOPE" == "tests" ]]; then
  rg -n "$PATTERN" tests/ --no-heading 2>/dev/null || true
else
  rg -n "$PATTERN" app/ --no-heading 2>/dev/null || true
fi
