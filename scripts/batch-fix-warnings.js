#!/usr/bin/env node

/**
 * Batch fix common ESLint warning patterns
 * Uses grep to find patterns and fixes them safely
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");

function log(message) {
  process.stdout.write(`${String(message)}\n`);
}

/**
 * Find and fix unnecessary ?? undefined patterns
 */
function fixUnnecessaryNullishUndefined() {
  log("🔍 Finding unnecessary ?? undefined patterns...");

  // Find files with this pattern
  const files = execSync(
    `grep -r "?? undefined" --include="*.ts" --include="*.tsx" app/ tests/ 2>/dev/null | cut -d: -f1 | sort -u`,
    { cwd: PROJECT_ROOT, encoding: "utf8" }
  )
    .trim()
    .split("\n")
    .filter(Boolean);

  let totalFixes = 0;

  files.forEach((file) => {
    const filePath = path.join(PROJECT_ROOT, file);
    if (!fs.existsSync(filePath)) return;

    let content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    let modified = false;
    let fixes = 0;

    lines.forEach((line, index) => {
      // Pattern: variable ?? undefined (when variable is already T | undefined)
      // Be conservative - only fix simple cases
      if (line.includes("?? undefined")) {
        // Match: word ?? undefined (not in strings or comments)
        const newLine = line.replace(
          /(\w+(?:\.\w+)*)\s*\?\?\s*undefined/g,
          (match, varName) => {
            // Skip if it's in a string or comment
            if (line.trim().startsWith("//") || line.includes("/*")) {
              return match;
            }
            // Only fix if it's a simple variable access
            if (/^\w+(?:\.\w+)*$/.test(varName)) {
              fixes++;
              modified = true;
              return varName;
            }
            return match;
          }
        );
        if (newLine !== line) {
          lines[index] = newLine;
        }
      }
    });

    if (modified) {
      fs.writeFileSync(filePath, lines.join("\n"), "utf8");
      totalFixes += fixes;
      log(`  ✅ Fixed ${fixes} issues in ${file}`);
    }
  });

  log(`\n✅ Fixed ${totalFixes} unnecessary ?? undefined patterns\n`);
  return totalFixes;
}

/**
 * Find and fix simple unnecessary optional chaining
 * Uses ESLint output to find exact locations
 */
function fixUnnecessaryOptionalChaining() {
  log("🔍 Finding unnecessary optional chaining patterns...");

  // Get all files with this warning from ESLint
  let lintOutput;
  try {
    lintOutput = execSync(`pnpm lint 2>&1`, {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (error) {
    lintOutput = error.stdout || error.message || "";
  }

  // Parse ESLint output to get file:line:col for each warning
  const warnings = [];
  const lines = lintOutput.split("\n");
  let currentFile = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // File path
    if (
      line.startsWith("/") &&
      (line.includes(".ts") || line.includes(".tsx"))
    ) {
      currentFile = line.trim();
    }
    // Warning line
    if (line.includes("Unnecessary optional chain") && currentFile) {
      const match = line.match(/(\d+):(\d+)/);
      if (match) {
        warnings.push({
          file: currentFile,
          line: parseInt(match[1], 10),
          col: parseInt(match[2], 10),
        });
      }
    }
  }

  // Group by file
  const filesMap = {};
  warnings.forEach((w) => {
    if (!filesMap[w.file]) {
      filesMap[w.file] = [];
    }
    filesMap[w.file].push(w);
  });

  let totalFixes = 0;

  Object.entries(filesMap).forEach(([file, fileWarnings]) => {
    const filePath = path.join(PROJECT_ROOT, file);
    if (!fs.existsSync(filePath)) return;

    try {
      let content = fs.readFileSync(filePath, "utf8");
      const lines = content.split("\n");
      let modified = false;
      let fixes = 0;

      fileWarnings.forEach((warning) => {
        const lineIndex = warning.line - 1;
        if (lineIndex < 0 || lineIndex >= lines.length) return;

        const line = lines[lineIndex];
        if (!line.includes("?.")) return;

        // Fix simple patterns: obj?.prop -> obj.prop
        // Handle various patterns: obj?.prop, obj?.prop?.nested, etc.
        let newLine = line;

        // Pattern 1: Simple property access obj?.prop (not a method call)
        newLine = newLine.replace(
          /(\w+(?:\.\w+)*)\?\.(\w+)(?!\()/g,
          (match, obj, prop) => {
            // Skip if it's followed by ( indicating a method call
            const restOfLine = line.substring(
              line.indexOf(match) + match.length
            );
            if (restOfLine.trim().startsWith("(")) {
              return match;
            }
            fixes++;
            modified = true;
            return `${obj}.${prop}`;
          }
        );

        // Pattern 2: Nested optional chaining - be more careful
        // Only fix if the whole chain is unnecessary
        newLine = newLine.replace(/(\w+)\?\.(\w+)\?\.(\w+)/g, (match) => {
          // This is trickier - only fix if we're sure
          // For now, skip nested chains
          return match;
        });

        if (newLine !== line) {
          lines[lineIndex] = newLine;
        }
      });

      if (modified) {
        fs.writeFileSync(filePath, lines.join("\n"), "utf8");
        totalFixes += fixes;
        log(`  ✅ Fixed ${fixes} issues in ${file}`);
      }
    } catch {
      // Skip files with errors
    }
  });

  log(`\n✅ Fixed ${totalFixes} unnecessary optional chaining patterns\n`);
  return totalFixes;
}

/**
 * Fix unnecessary conditionals that are always truthy/falsy
 * Very conservative - only fix obvious cases
 */
function fixUnnecessaryConditionals() {
  log("🔍 Finding unnecessary conditionals...");

  let lintOutput;
  try {
    lintOutput = execSync(`pnpm lint 2>&1`, {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (error) {
    lintOutput = error.stdout || error.message || "";
  }

  const warnings = [];
  const lines = lintOutput.split("\n");
  let currentFile = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      line.startsWith("/") &&
      (line.includes(".ts") || line.includes(".tsx"))
    ) {
      currentFile = line.trim();
    }
    if (
      (line.includes("value is always truthy") ||
        line.includes("value is always falsy") ||
        line.includes("types have no overlap")) &&
      currentFile
    ) {
      const match = line.match(/(\d+):(\d+)/);
      if (match) {
        warnings.push({
          file: currentFile,
          line: parseInt(match[1], 10),
          message: line,
        });
      }
    }
  }

  // Group by file
  const filesMap = {};
  warnings.forEach((w) => {
    if (!filesMap[w.file]) {
      filesMap[w.file] = [];
    }
    filesMap[w.file].push(w);
  });

  Object.entries(filesMap).forEach(([file, fileWarnings]) => {
    const filePath = path.join(PROJECT_ROOT, file);
    if (!fs.existsSync(filePath)) return;

    try {
      const content = fs.readFileSync(filePath, "utf8");
      const lines = content.split("\n");

      fileWarnings.forEach((warning) => {
        const lineIndex = warning.line - 1;
        if (lineIndex < 0 || lineIndex >= lines.length) return;

        // Fix: if (alwaysTruthy) -> remove if, keep body
        // Fix: if (alwaysFalsy) -> remove entire if block
        // This is complex and risky - skip for now, require manual review
        // We'll just log them for manual fixing
        // Line would be available at lines[lineIndex] when implemented
      });
    } catch {
      // Skip files with errors
    }
  });

  log(
    `\n⚠️  Found ${warnings.length} unnecessary conditionals (require manual review)\n`
  );
  return 0; // Don't auto-fix these, too risky
}

/**
 * Fix duplicate string literals by extracting constants
 */
function fixDuplicateStringLiterals() {
  log("🔍 Finding duplicate string literals...");

  // This requires analyzing the codebase for repeated strings
  // For now, we'll just identify them
  let lintOutput;
  try {
    lintOutput = execSync(`pnpm lint 2>&1`, {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (error) {
    lintOutput = error.stdout || error.message || "";
  }

  const warnings = [];
  const lines = lintOutput.split("\n");
  let currentFile = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      line.startsWith("/") &&
      (line.includes(".ts") || line.includes(".tsx"))
    ) {
      currentFile = line.trim();
    }
    if (
      line.includes("Define a constant instead of duplicating this literal") &&
      currentFile
    ) {
      const match = line.match(/(\d+):(\d+)/);
      if (match) {
        warnings.push({
          file: currentFile,
          line: parseInt(match[1], 10),
        });
      }
    }
  }

  log(
    `\n⚠️  Found ${warnings.length} duplicate string literals (require manual extraction)\n`
  );
  return 0; // Don't auto-fix, requires understanding context
}

function main() {
  log("🚀 Batch Fixing ESLint Warnings\n");
  log("=".repeat(60));

  let totalFixes = 0;

  totalFixes += fixUnnecessaryNullishUndefined();
  totalFixes += fixUnnecessaryOptionalChaining();
  fixUnnecessaryConditionals();
  fixDuplicateStringLiterals();

  log("=".repeat(60));
  log(`\n✅ Total fixes: ${totalFixes}`);
  log("\n💡 Run 'pnpm lint' to see remaining warnings\n");
}

if (require.main === module) {
  main();
}

module.exports = { main };
