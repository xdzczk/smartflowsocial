/**
 * Replay outbox dead-lettered events with explicit operator confirmation.
 *
 * Usage:
 *   npx tsx scripts/replay-outbox-dead-letter.ts --list --limit=20
 *   npx tsx scripts/replay-outbox-dead-letter.ts --event-id=<id> --confirm=REPLAY
 */

import { resolve } from "node:path";

import { config } from "dotenv";

import {
  getDeadLetteredOutboxEvents,
  replayDeadLetteredOutboxEvent,
} from "../app/infra/outbox/outbox.server";

const { log, error: logError } = require("./logger") as {
  log: (..._args: unknown[]) => void;
  error: (..._args: unknown[]) => void;
};

config({ path: resolve(process.cwd(), ".env") });

function getArg(name: string): string | undefined {
  const full = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return full?.split("=")[1];
}

async function main() {
  const list = process.argv.includes("--list");
  const eventId = getArg("event-id");
  const confirm = getArg("confirm");
  const actor = getArg("actor") ?? "manual-operator";
  const limit = Number(getArg("limit") ?? "20");

  if (list) {
    const events = await getDeadLetteredOutboxEvents(limit);
    for (const event of events) {
      log(
        JSON.stringify({
          id: event.id,
          eventType: event.eventType,
          aggregateId: event.aggregateId,
          deadLetteredAt: event.deadLetteredAt?.toISOString(),
          lastError: event.lastError,
        })
      );
    }
    return;
  }

  if (!eventId) {
    throw new Error("Missing --event-id=<outboxEventId> or use --list");
  }
  if (confirm !== "REPLAY") {
    throw new Error(
      "Replay is guarded. Pass --confirm=REPLAY to execute this operation."
    );
  }

  const replayed = await replayDeadLetteredOutboxEvent(eventId);
  if (!replayed) {
    throw new Error(`Outbox event ${eventId} was not replayed`);
  }

  log(
    JSON.stringify({
      action: "outbox_dead_letter_replay",
      eventId,
      actor,
      replayedAt: new Date().toISOString(),
    })
  );
}

void main().catch((error) => {
  logError(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
