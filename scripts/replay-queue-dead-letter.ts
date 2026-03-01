/**
 * Replay queue dead-letter jobs with explicit operator confirmation.
 *
 * Usage:
 *   npx tsx scripts/replay-queue-dead-letter.ts --list --limit=20
 *   npx tsx scripts/replay-queue-dead-letter.ts --entry-id=<id> --confirm=REPLAY
 */

import { resolve } from "node:path";

import { config } from "dotenv";

import {
  getDeadLetterEntries,
  retryDeadLetterJob,
} from "../app/infra/queue/dead-letter-queue.server";

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
  const entryId = getArg("entry-id");
  const confirm = getArg("confirm");
  const actor = getArg("actor") ?? "manual-operator";
  const limit = Number(getArg("limit") ?? "20");

  if (list) {
    const entries = await getDeadLetterEntries(undefined, limit);
    for (const entry of entries) {
      log(
        JSON.stringify({
          id: entry.id,
          queueType: entry.queueType,
          jobId: entry.jobId,
          jobName: entry.jobName,
          attemptsMade: entry.attemptsMade,
          createdAt: entry.createdAt.toISOString(),
          error: entry.error,
        })
      );
    }
    return;
  }

  if (!entryId) {
    throw new Error("Missing --entry-id=<deadLetterEntryId> or use --list");
  }
  if (confirm !== "REPLAY") {
    throw new Error(
      "Replay is guarded. Pass --confirm=REPLAY to execute this operation."
    );
  }

  const result = await retryDeadLetterJob(entryId);
  if (!result.success) {
    throw new Error(result.error ?? "Failed to replay dead-letter job");
  }

  log(
    JSON.stringify({
      action: "queue_dead_letter_replay",
      entryId,
      actor,
      replayedAt: new Date().toISOString(),
    })
  );
}

void main().catch((error) => {
  logError(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
