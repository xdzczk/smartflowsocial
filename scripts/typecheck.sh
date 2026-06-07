#!/bin/bash
set -e

export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"

check_tsconfig() {
  local label="$1"
  local tsconfig_args="$2"
  echo "🔍 Running ${label} TypeScript type check..."

  local output
  if [ -n "$tsconfig_args" ]; then
    output=$(tsc $tsconfig_args --noEmit 2>&1 || true)
  else
    output=$(tsc --noEmit 2>&1 || true)
  fi

  local errors
  errors=$(echo "$output" | grep -E 'error TS' | grep -v 'node_modules' || true)

  if [ -n "$errors" ]; then
    echo "❌ TypeScript errors found in ${label}:"
    echo "$errors"
    return 1
  fi

  echo "✅ ${label} TypeScript type check passed"
  return 0
}

pids=()
labels=()

check_tsconfig "app" "" &
pids+=("$!")
labels+=("app")

if [ -f "tests/e2e/tsconfig.json" ]; then
  check_tsconfig "e2e" "-p tests/e2e/tsconfig.json" &
  pids+=("$!")
  labels+=("e2e")
fi

status=0
for i in "${!pids[@]}"; do
  if ! wait "${pids[$i]}"; then
    status=1
  fi
done

if [ "$status" -ne 0 ]; then
  exit 1
fi

echo "✅ TypeScript type check passed (all configs)"
