#!/usr/bin/env tsx

/**
 * Backfill LongFormPost States Script
 *
 * This script backfills currentState for longform posts that don't have it set.
 * It derives state from flags (for legacy data).
 *
 * Usage:
 *   pnpm tsx scripts/backfill-longform-post-states.ts
 *   pnpm tsx scripts/backfill-longform-post-states.ts --fix-inconsistencies
 *   pnpm tsx scripts/backfill-longform-post-states.ts --validate-only
 */

import {
  backfillLongFormPostCurrentState,
  fixLongFormPostStateInconsistencies,
  validateAllLongFormPostStates,
} from "~/features/posts/longform/index.server";
import { logInfo } from "~/lib/error-logger.server";

// Script logger (avoids console.*)

const { log, error: logError } = require("./logger") as {
  log: (..._args: unknown[]) => void;
  error: (..._args: unknown[]) => void;
};

async function main() {
  const args = process.argv.slice(2);
  const fixInconsistencies = args.includes("--fix-inconsistencies");
  const validateOnly = args.includes("--validate-only");

  if (validateOnly) {
    log("Validating longform post state consistency...");
    const inconsistencies = await validateAllLongFormPostStates(10000);

    if (inconsistencies.length === 0) {
      log("✅ All longform posts have consistent state and flags!");
      return;
    }

    log(
      `\n⚠️  Found ${inconsistencies.length} longform posts with inconsistencies:\n`
    );

    for (const inconsistency of inconsistencies.slice(0, 10)) {
      log(`LongFormPost ${inconsistency.postId}:`);
      log(`  Current State: ${inconsistency.currentState ?? "null"}`);
      log(
        `  Flags: isPublished=${inconsistency.isPublished}, isScheduled=${inconsistency.isScheduled}, draft=${inconsistency.draft}`
      );
      for (const issue of inconsistency.inconsistencies) {
        log(`  - ${issue}`);
      }
      log("");
    }

    if (inconsistencies.length > 10) {
      log(`\n... and ${inconsistencies.length - 10} more`);
    }

    if (fixInconsistencies) {
      log("\nFixing inconsistencies...");
      const result = await fixLongFormPostStateInconsistencies(inconsistencies);
      log(`✅ Fixed ${result.fixed} longform posts, ${result.errors} errors`);
    } else {
      log("\n💡 Run with --fix-inconsistencies to automatically fix these");
    }
    return;
  }

  log("Backfilling currentState for longform posts without state...");
  const result = await backfillLongFormPostCurrentState(10000);

  log(
    `✅ Backfilled ${result.backfilled} longform posts, ${result.errors} errors`
  );

  if (result.backfilled > 0) {
    log("\nValidating consistency after backfill...");
    const inconsistencies = await validateAllLongFormPostStates(10000);
    if (inconsistencies.length === 0) {
      log("✅ All longform posts now have consistent state!");
    } else {
      log(`⚠️  Found ${inconsistencies.length} remaining inconsistencies`);
      log("💡 Run with --validate-only --fix-inconsistencies to fix them");
    }
  }

  logInfo("Backfill longform post states completed", {
    backfilled: result.backfilled,
    errors: result.errors,
  });
}

main().catch((err) => {
  logError("Error:", err);
  process.exit(1);
});
