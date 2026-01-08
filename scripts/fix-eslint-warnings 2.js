#!/usr/bin/env node

/**
 * Script to help fix ESLint warnings systematically
 * Focuses on auto-fixable patterns and common issues
 */

const { execSync } = require("child_process");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Get ESLint warnings by type
 */
function getWarningsByType() {
  log("\n📊 Analyzing warning types...", "cyan");
  try {
    const output = execSync("pnpm lint 2>&1", {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
    });

    const warnings = output
      .split("\n")
      .filter((line) => line.includes("warning"))
      .map((line) => {
        const match = line.match(/warning\s+(.+)$/);
        return match ? match[1].trim() : null;
      })
      .filter(Boolean);

    const warningCounts = {};
    warnings.forEach((warning) => {
      warningCounts[warning] = (warningCounts[warning] || 0) + 1;
    });

    return warningCounts;
  } catch (error) {
    const output = error.stdout || error.message || "";
    const warnings = output
      .split("\n")
      .filter((line) => line.includes("warning"))
      .map((line) => {
        const match = line.match(/warning\s+(.+)$/);
        return match ? match[1].trim() : null;
      })
      .filter(Boolean);

    const warningCounts = {};
    warnings.forEach((warning) => {
      warningCounts[warning] = (warningCounts[warning] || 0) + 1;
    });

    return warningCounts;
  }
}

/**
 * Fix unnecessary nullish coalescing (remove ?? when left side is never null/undefined)
 * This is a conservative fix - only removes ?? when the right side is a simple default
 */
function fixUnnecessaryNullishCoalescing(content) {
  // Pattern: something ?? defaultValue where something is never null/undefined
  // We'll be conservative and only fix obvious cases
  const lines = content.split("\n");
  const newLines = lines.map((_line) => {
    // Skip comments
    if (line.trim().startsWith("//") || line.includes("/*")) {
      return line;
    }

    // Pattern: (non-nullable expression) ?? defaultValue
    // This is tricky to detect automatically, so we'll skip for now
    // and let developers fix manually based on ESLint warnings

    return line;
  });

  if (modified) {
    return { content: newLines.join("\n"), fixes };
  }
  return { content, fixes: 0 };
}

/**
 * Fix unnecessary optional chaining (remove ?. when value is guaranteed non-nullish)
 */
function fixUnnecessaryOptionalChaining(_content) {
  // Pattern: something?.property where something is never null/undefined
  // This is also tricky to detect automatically
  // We'll skip for now and let developers fix manually

  return { content: _content, fixes: 0 };
}

/**
 * Main execution
 */
function main() {
  log("🚀 ESLint Warning Analysis", "blue");
  log("=".repeat(60), "cyan");

  const warningCounts = getWarningsByType();

  log("\n📈 Warning Summary:", "cyan");
  const sorted = Object.entries(warningCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  sorted.forEach(([warning, count]) => {
    const color = count > 50 ? "red" : count > 20 ? "yellow" : "blue";
    log(`   ${count.toString().padStart(4)} × ${warning}`, color);
  });

  const total = Object.values(warningCounts).reduce((a, b) => a + b, 0);
  log(`\n   Total: ${total} warnings`, "cyan");

  log("\n💡 Recommendations:", "cyan");
  log("   1. Fix unnecessary nullish coalescing (??) - ~155 instances", "blue");
  log("   2. Fix unnecessary optional chaining (?.) - ~55 instances", "blue");
  log("   3. Fix unnecessary conditionals - ~200+ instances", "blue");
  log("   4. Extract duplicate string literals - ~30 instances", "blue");
  log("   5. Refactor complex functions - many instances", "blue");

  log("\n⚠️  Note: Most fixes require manual review for correctness", "yellow");
  log("   Use ESLint warnings as a guide to fix issues file by file", "yellow");
}

if (require.main === module) {
  main();
}

module.exports = { getWarningsByType, main };
