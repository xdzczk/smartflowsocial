# Replay Runbook

Use replay only after you identify and fix the underlying failure cause.

## Queue Dead-Letter Replay

- List entries: `npx tsx scripts/replay-queue-dead-letter.ts --list --limit=20`
- Replay one entry:
  - `npx tsx scripts/replay-queue-dead-letter.ts --entry-id=<id> --confirm=REPLAY --actor=<name>`

## Outbox Dead-Letter Replay

- List events: `npx tsx scripts/replay-outbox-dead-letter.ts --list --limit=20`
- Replay one event:
  - `npx tsx scripts/replay-outbox-dead-letter.ts --event-id=<id> --confirm=REPLAY --actor=<name>`

## Guardrails

- Replay is blocked unless `--confirm=REPLAY` is provided.
- Replay one item at a time and verify metrics/logs before continuing.
- Preserve audit context with `--actor=<name>` in all production replays.
