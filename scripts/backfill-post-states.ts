#!/usr/bin/env tsx

/**
 * Backfill Post States Script
 *
 * This script backfills currentState for posts that don't have it set.
 * It derives state from flags (for legacy data).
 *
 * Usage:
 *   pnpm tsx scripts/backfill-post-states.ts
 *   pnpm tsx scripts/backfill-post-states.ts --fix-inconsistencies
 *   pnpm tsx scripts/backfill-post-states.ts --validate-only
 */

import {
  backfillCurrentState,
  fixPostStateInconsistencies,
  validateAllPostStates,
} from "~/features/posts/state-machine/post-state-validator.server";

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
    log("Validating post state consistency...");
    const inconsistencies = await validateAllPostStates(10000);

    if (inconsistencies.length === 0) {
      log("✅ All posts have consistent state and flags!");
      return;
    }

    log(`\n⚠️  Found ${inconsistencies.length} posts with inconsistencies:\n`);

    for (const inconsistency of inconsistencies.slice(0, 10)) {
      log(`Post ${inconsistency.postId}:`);
      for (const issue of inconsistency.inconsistencies) {
        log(`  - ${issue}`);
      }
    }

    if (inconsistencies.length > 10) {
      log(`\n... and ${inconsistencies.length - 10} more`);
    }

    if (fixInconsistencies) {
      log("\nFixing inconsistencies...");
      const result = await fixPostStateInconsistencies(inconsistencies);
      log(`✅ Fixed ${result.fixed} posts, ${result.errors} errors`);
    } else {
      log("\n💡 Run with --fix-inconsistencies to automatically fix these");
    }
    return;
  }

  log("Backfilling currentState for posts without state...");
  const result = await backfillCurrentState(10000);

  log(`✅ Backfilled ${result.backfilled} posts, ${result.errors} errors`);

  if (result.backfilled > 0) {
    log("\nValidating consistency after backfill...");
    const inconsistencies = await validateAllPostStates(10000);

    if (inconsistencies.length === 0) {
      log("✅ All posts now have consistent state and flags!");
    } else {
      log(
        `⚠️  Found ${inconsistencies.length} posts with remaining inconsistencies`
      );
      log("💡 Run with --validate-only --fix-inconsistencies to fix them");
    }
  }
}

main().catch((err) => {
  logError("Error:", err);
  process.exit(1);
});
