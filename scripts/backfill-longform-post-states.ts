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
} from "~/features/posts/state-machine/longform-post-state-validator.server";
import { logInfo } from "~/lib/error-logger.server";

async function main() {
  const args = process.argv.slice(2);
  const fixInconsistencies = args.includes("--fix-inconsistencies");
  const validateOnly = args.includes("--validate-only");

  if (validateOnly) {
    console.log("Validating longform post state consistency...");
    const inconsistencies = await validateAllLongFormPostStates(10000);

    if (inconsistencies.length === 0) {
      console.log("✅ All longform posts have consistent state and flags!");
      return;
    }

    console.log(
      `\n⚠️  Found ${inconsistencies.length} longform posts with inconsistencies:\n`
    );

    for (const inconsistency of inconsistencies.slice(0, 10)) {
      console.log(`LongFormPost ${inconsistency.postId}:`);
      console.log(`  Current State: ${inconsistency.currentState ?? "null"}`);
      console.log(
        `  Flags: isPublished=${inconsistency.isPublished}, isScheduled=${inconsistency.isScheduled}, draft=${inconsistency.draft}`
      );
      for (const issue of inconsistency.inconsistencies) {
        console.log(`  - ${issue}`);
      }
      console.log();
    }

    if (inconsistencies.length > 10) {
      console.log(`\n... and ${inconsistencies.length - 10} more`);
    }

    if (fixInconsistencies) {
      console.log("\nFixing inconsistencies...");
      const result = await fixLongFormPostStateInconsistencies(inconsistencies);
      console.log(
        `✅ Fixed ${result.fixed} longform posts, ${result.errors} errors`
      );
    } else {
      console.log(
        "\n💡 Run with --fix-inconsistencies to automatically fix these"
      );
    }
    return;
  }

  console.log("Backfilling currentState for longform posts without state...");
  const result = await backfillLongFormPostCurrentState(10000);

  console.log(
    `✅ Backfilled ${result.backfilled} longform posts, ${result.errors} errors`
  );

  if (result.backfilled > 0) {
    console.log("\nValidating consistency after backfill...");
    const inconsistencies = await validateAllLongFormPostStates(10000);
    if (inconsistencies.length === 0) {
      console.log("✅ All longform posts now have consistent state!");
    } else {
      console.log(
        `⚠️  Found ${inconsistencies.length} remaining inconsistencies`
      );
      console.log(
        "💡 Run with --validate-only --fix-inconsistencies to fix them"
      );
    }
  }

  logInfo("Backfill longform post states completed", {
    backfilled: result.backfilled,
    errors: result.errors,
  });
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
