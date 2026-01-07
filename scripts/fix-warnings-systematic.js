#!/usr/bin/env node

/**
 * Systematic ESLint warning fixer
 * Focuses on safe, automated fixes for common patterns
 */

const { execSync } = require("child_process");
const fs = require("fs");
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
 * Get warnings for a specific file
 */
function getWarningsForFile(filePath) {
  try {
    const output = execSync(`pnpm lint "${filePath}" 2>&1`, {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
    });
    return output
      .split("\n")
      .filter((line) => line.includes("warning"))
      .map((line) => {
        const match = line.match(/(\d+):(\d+)\s+warning\s+(.+)$/);
        if (match) {
          return {
            line: parseInt(match[1], 10),
            col: parseInt(match[2], 10),
            message: match[3].trim(),
          };
        }
        return null;
      })
      .filter(Boolean);
  } catch (error) {
    const output = error.stdout || error.message || "";
    return output
      .split("\n")
      .filter((line) => line.includes("warning"))
      .map((line) => {
        const match = line.match(/(\d+):(\d+)\s+warning\s+(.+)$/);
        if (match) {
          return {
            line: parseInt(match[1], 10),
            col: parseInt(match[2], 10),
            message: match[3].trim(),
          };
        }
        return null;
      })
      .filter(Boolean);
  }
}

/**
 * Fix unnecessary nullish coalescing: value ?? undefined
 * Only when value is already string | undefined or similar
 */
function fixUnnecessaryNullishCoalescing(content, warnings) {
  const nullishWarnings = warnings.filter((w) =>
    w.message.includes("left-hand side of `??` operator")
  );

  if (nullishWarnings.length === 0) return { content, fixes: 0 };

  const lines = content.split("\n");
  let fixes = 0;

  nullishWarnings.forEach((warning) => {
    const lineIndex = warning.line - 1;
    if (lineIndex < 0 || lineIndex >= lines.length) return;

    const line = lines[lineIndex];
    // Pattern: something ?? undefined or something ?? null
    // Be conservative - only fix ?? undefined when it's clearly unnecessary
    if (line.includes("?? undefined")) {
      // Check if it's a simple case: variable ?? undefined
      const match = line.match(/(\w+(?:\.\w+)*)\s*\?\?\s*undefined/g);
      if (match) {
        lines[lineIndex] = line.replace(/\?\?\s*undefined/g, "");
        fixes++;
      }
    }
  });

  return { content: lines.join("\n"), fixes };
}

/**
 * Fix unnecessary optional chaining: value?.property when value is non-nullish
 */
function fixUnnecessaryOptionalChaining(content, warnings) {
  const optionalWarnings = warnings.filter((w) =>
    w.message.includes("Unnecessary optional chain")
  );

  if (optionalWarnings.length === 0) return { content, fixes: 0 };

  const lines = content.split("\n");
  let fixes = 0;

  optionalWarnings.forEach((warning) => {
    const lineIndex = warning.line - 1;
    if (lineIndex < 0 || lineIndex >= lines.length) return;

    const line = lines[lineIndex];
    // Pattern: something?.property -> something.property
    // Be very conservative - only fix obvious cases
    const match = line.match(/(\w+)\.(\w+)/);
    if (match && line.includes("?.")) {
      // Only fix if it's a simple property access
      const newLine = line.replace(/(\w+)\?\.(\w+)/g, "$1.$2");
      if (newLine !== line) {
        lines[lineIndex] = newLine;
        fixes++;
      }
    }
  });

  return { content: lines.join("\n"), fixes };
}

/**
 * Fix unnecessary conditionals: if (alwaysTruthy) or if (alwaysFalsy)
 */
function _fixUnnecessaryConditionals(content, warnings) {
  const conditionalWarnings = warnings.filter(
    (w) =>
      w.message.includes("value is always truthy") ||
      w.message.includes("value is always falsy") ||
      w.message.includes("types have no overlap")
  );

  if (conditionalWarnings.length === 0) return { content, fixes: 0 };

  // This requires more careful analysis - skip for now
  // as it might change logic
  return { content, fixes: 0 };
}

/**
 * Process a single file
 */
function processFile(filePath) {
  const relativePath = path.relative(PROJECT_ROOT, filePath);
  const warnings = getWarningsForFile(filePath);

  if (warnings.length === 0) return { fixed: false, fixes: 0 };

  try {
    let content = fs.readFileSync(filePath, "utf8");
    let totalFixes = 0;

    // Fix unnecessary nullish coalescing
    const nullishResult = fixUnnecessaryNullishCoalescing(content, warnings);
    if (nullishResult.fixes > 0) {
      content = nullishResult.content;
      totalFixes += nullishResult.fixes;
    }

    // Fix unnecessary optional chaining
    const optionalResult = fixUnnecessaryOptionalChaining(content, warnings);
    if (optionalResult.fixes > 0) {
      content = optionalResult.content;
      totalFixes += optionalResult.fixes;
    }

    if (totalFixes > 0) {
      fs.writeFileSync(filePath, content, "utf8");
      return { fixed: true, fixes: totalFixes };
    }

    return { fixed: false, fixes: 0 };
  } catch (error) {
    log(`  ⚠️  Error processing ${relativePath}: ${error.message}`, "yellow");
    return { fixed: false, fixes: 0 };
  }
}

/**
 * Main execution
 */
function main() {
  log("🚀 Systematic ESLint Warning Fixer", "blue");
  log("=".repeat(60), "cyan");

  // Get all TypeScript files
  const targetDirs = [
    path.join(PROJECT_ROOT, "app"),
    path.join(PROJECT_ROOT, "tests"),
  ];

  const files = [];
  targetDirs.forEach((dir) => {
    if (!fs.existsSync(dir)) return;
    const walk = (dirPath) => {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      entries.forEach((entry) => {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          if (
            !entry.name.startsWith(".") &&
            entry.name !== "node_modules" &&
            entry.name !== "build"
          ) {
            walk(fullPath);
          }
        } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
          files.push(fullPath);
        }
      });
    };
    walk(dir);
  });

  log(`\n📁 Found ${files.length} files to check`, "cyan");

  let filesFixed = 0;
  let totalFixes = 0;

  files.forEach((file, index) => {
    if ((index + 1) % 50 === 0) {
      log(`  Processing file ${index + 1}/${files.length}...`, "blue");
    }
    const result = processFile(file);
    if (result.fixed) {
      filesFixed++;
      totalFixes += result.fixes;
    }
  });

  log("\n" + "=".repeat(60), "cyan");
  log(`✅ Fixed ${totalFixes} issues in ${filesFixed} files`, "green");
  log("\n💡 Run 'pnpm lint' to see remaining warnings", "blue");
}

if (require.main === module) {
  main();
}

module.exports = { processFile, main };

