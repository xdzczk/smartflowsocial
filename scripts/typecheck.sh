#!/bin/bash
set -e

# Run main TypeScript check and filter out node_modules errors
echo "🔍 Running TypeScript type check..."
MAIN_OUTPUT=$(tsc --noEmit 2>&1 || true)
MAIN_ERRORS=$(echo "$MAIN_OUTPUT" | grep -E 'error TS' | grep -v 'node_modules' || true)

if [ -n "$MAIN_ERRORS" ]; then
  echo "❌ TypeScript errors found in codebase:"
  echo "$MAIN_ERRORS"
  exit 1
fi

# Run e2e TypeScript check and filter out node_modules errors
if [ -f "tests/e2e/tsconfig.json" ]; then
  echo "🔍 Running E2E TypeScript type check..."
  E2E_OUTPUT=$(tsc -p tests/e2e/tsconfig.json --noEmit 2>&1 || true)
  E2E_ERRORS=$(echo "$E2E_OUTPUT" | grep -E 'error TS' | grep -v 'node_modules' || true)
  
  if [ -n "$E2E_ERRORS" ]; then
    echo "❌ TypeScript errors found in e2e tests:"
    echo "$E2E_ERRORS"
    exit 1
  fi
fi

echo "✅ TypeScript type check passed (all configs)"


