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

async function main() {
  const args = process.argv.slice(2);
  const fixInconsistencies = args.includes("--fix-inconsistencies");
  const validateOnly = args.includes("--validate-only");

  if (validateOnly) {
    console.log("Validating post state consistency...");
    const inconsistencies = await validateAllPostStates(10000);

    if (inconsistencies.length === 0) {
      console.log("✅ All posts have consistent state and flags!");
      return;
    }

    console.log(
      `\n⚠️  Found ${inconsistencies.length} posts with inconsistencies:\n`
    );

    for (const inconsistency of inconsistencies.slice(0, 10)) {
      console.log(`Post ${inconsistency.postId}:`);
      for (const issue of inconsistency.inconsistencies) {
        console.log(`  - ${issue}`);
      }
    }

    if (inconsistencies.length > 10) {
      console.log(`\n... and ${inconsistencies.length - 10} more`);
    }

    if (fixInconsistencies) {
      console.log("\nFixing inconsistencies...");
      const result = await fixPostStateInconsistencies(inconsistencies);
      console.log(`✅ Fixed ${result.fixed} posts, ${result.errors} errors`);
    } else {
      console.log(
        "\n💡 Run with --fix-inconsistencies to automatically fix these"
      );
    }
    return;
  }

  console.log("Backfilling currentState for posts without state...");
  const result = await backfillCurrentState(10000);

  console.log(
    `✅ Backfilled ${result.backfilled} posts, ${result.errors} errors`
  );

  if (result.backfilled > 0) {
    console.log("\nValidating consistency after backfill...");
    const inconsistencies = await validateAllPostStates(10000);

    if (inconsistencies.length === 0) {
      console.log("✅ All posts now have consistent state and flags!");
    } else {
      console.log(
        `⚠️  Found ${inconsistencies.length} posts with remaining inconsistencies`
      );
      console.log(
        "💡 Run with --validate-only --fix-inconsistencies to fix them"
      );
    }
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
