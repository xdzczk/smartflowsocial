#!/usr/bin/env node

/**
 * Batch fix unnecessary nullish coalescing patterns
 * Focuses on patterns where the left side is guaranteed non-nullish
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const PROJECT_ROOT = path.resolve(__dirname, "..");

function log(message) {
  process.stdout.write(`${String(message)}\n`);
}

/**
 * Get files with nullish coalescing warnings
 */
function getFilesWithWarnings() {
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

  const fileWarnings = {};
  const lines = lintOutput.split("\n");
  let currentFile = null;

  for (const line of lines) {
    if (
      line.startsWith("/") &&
      (line.includes(".ts") || line.includes(".tsx"))
    ) {
      currentFile = line.trim();
    }
    if (line.includes("left-hand side of `??` operator") && currentFile) {
      const match = line.match(/(\d+):(\d+)/);
      if (match) {
        if (!fileWarnings[currentFile]) {
          fileWarnings[currentFile] = [];
        }
        fileWarnings[currentFile].push({
          line: parseInt(match[1], 10),
          col: parseInt(match[2], 10),
        });
      }
    }
  }

  return fileWarnings;
}

/**
 * Fix patterns in a file
 */
function fixFile(filePath, warnings) {
  if (!fs.existsSync(filePath)) return { fixes: 0 };

  let content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  let fixes = 0;
  let modified = false;

  // Sort warnings by line (descending) to avoid offset issues
  warnings.sort((a, b) => b.line - a.line);

  warnings.forEach((warning) => {
    const lineIndex = warning.line - 1;
    if (lineIndex < 0 || lineIndex >= lines.length) return;

    const line = lines[lineIndex];
    const colIndex = warning.col - 1;

    // Find the ?? pattern near this column
    // Look for patterns like: variable ?? defaultValue
    // Variables extracted for potential future use in pattern matching
    void line.substring(0, Math.max(0, colIndex - 20));
    void line.substring(Math.max(0, colIndex - 20));

    // Pattern 1: variable ?? undefined (most common, already handled but check for remaining)
    if (line.includes("?? undefined")) {
      const newLine = line.replace(
        /(\w+(?:\.\w+)*)\s*\?\?\s*undefined\b/g,
        (match, varName) => {
          // Skip if in comment
          if (line.trim().startsWith("//") || line.includes("/*")) {
            return match;
          }
          fixes++;
          modified = true;
          return varName;
        }
      );
      if (newLine !== line) {
        lines[lineIndex] = newLine;
      }
    }

    // Pattern 2: variable ?? "" when variable is string | undefined (not string | null | undefined)
    // This is trickier - we'll be conservative
    // Pattern 3: variable ?? null when variable is already T | null
    // Also tricky - skip for now

    // Pattern 4: Always null/undefined cases - remove the ?? and just use the right side
    // Check if the warning message says "always null or undefined"
    // We can't easily detect this from the warning, so we'll skip
  });

  if (modified) {
    fs.writeFileSync(filePath, lines.join("\n"), "utf8");
  }

  return { fixes, modified };
}

function main() {
  log("🔍 Finding and fixing unnecessary nullish coalescing...\n");

  const fileWarnings = getFilesWithWarnings();
  const files = Object.keys(fileWarnings);

  log(
    `Found ${files.length} files with unnecessary nullish coalescing warnings\n`
  );

  let totalFixes = 0;
  const processedFiles = [];

  files.forEach((file) => {
    const filePath = path.join(PROJECT_ROOT, file);
    const result = fixFile(filePath, fileWarnings[file]);

    if (result.modified && result.fixes > 0) {
      totalFixes += result.fixes;
      processedFiles.push({ file, fixes: result.fixes });
    }
  });

  log(`\n✅ Fixed ${totalFixes} issues in ${processedFiles.length} files:\n`);
  processedFiles.forEach(({ file, fixes }) => {
    log(`  ${file}: ${fixes} fixes`);
  });

  log(`\n💡 Run 'pnpm lint' to verify\n`);
}

if (require.main === module) {
  main();
}

module.exports = { main };
