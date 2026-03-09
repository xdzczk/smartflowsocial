#!/usr/bin/env bash
# Audit eslint-disable and TypeScript suppressions for the backlog (see CONTRIBUTING.md § Lint and type suppression policy).
# Usage: ./scripts/audit-suppressions.sh [app|tests|all]
# Output: tab-separated file, line, match, category (placeholder)

set -e
SCOPE="${1:-app}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PATTERN="eslint-disable|@ts-ignore|@ts-expect-error|@ts-nocheck"
echo -e "file\tline\tmatch\tcategory"

if [[ "$SCOPE" == "all" ]]; then
  rg -n "$PATTERN" app/ tests/ --no-heading 2>/dev/null || true
elif [[ "$SCOPE" == "tests" ]]; then
  rg -n "$PATTERN" tests/ --no-heading 2>/dev/null || true
else
  rg -n "$PATTERN" app/ --no-heading 2>/dev/null || true
fi | while IFS= read -r line; do
  # Parse "path:line_num:rest" (rest may contain colons)
  file="${line%%:*}"
  rest="${line#*:}"
  line_no="${rest%%:*}"
  match="${rest#*:}"
  printf "%s\t%s\t%s\t\n" "$file" "$line_no" "$match"
done
