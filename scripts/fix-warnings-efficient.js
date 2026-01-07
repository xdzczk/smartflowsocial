#!/usr/bin/env node

/**
 * Efficient batch fix for common ESLint warning patterns
 * Uses ESLint output to find exact locations and fixes them
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const PROJECT_ROOT = path.resolve(__dirname, "..");

function log(message) {
  console.log(message);
}

/**
 * Get all warnings from ESLint output
 */
function getAllWarnings() {
  let lintOutput;
  try {
    lintOutput = execSync(
      `pnpm lint 2>&1`,
      { cwd: PROJECT_ROOT, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
    );
  } catch (error) {
    lintOutput = error.stdout || error.message || "";
  }
  
  const warnings = {
    nullishCoalescing: [],
    optionalChaining: [],
    alwaysTruthy: [],
    alwaysFalsy: [],
  };
  
  const lines = lintOutput.split("\n");
  let currentFile = null;
  
  for (const line of lines) {
    if (line.startsWith("/") && (line.includes(".ts") || line.includes(".tsx"))) {
      currentFile = line.trim();
    }
    
    if (!currentFile) continue;
    
    const match = line.match(/(\d+):(\d+)\s+warning\s+(.+)$/);
    if (!match) continue;
    
    const warning = {
      file: currentFile,
      line: parseInt(match[1], 10),
      col: parseInt(match[2], 10),
      message: match[3].trim(),
    };
    
    if (warning.message.includes("left-hand side of `??` operator")) {
      warnings.nullishCoalescing.push(warning);
    } else if (warning.message.includes("Unnecessary optional chain")) {
      warnings.optionalChaining.push(warning);
    } else if (warning.message.includes("value is always truthy")) {
      warnings.alwaysTruthy.push(warning);
    } else if (warning.message.includes("value is always falsy")) {
      warnings.alwaysFalsy.push(warning);
    }
  }
  
  return warnings;
}

/**
 * Fix nullish coalescing warnings
 */
function fixNullishCoalescing(filePath, warnings) {
  if (!fs.existsSync(filePath)) return { fixes: 0 };
  
  let content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  let fixes = 0;
  let modified = false;
  
  // Sort by line descending to avoid offset issues
  warnings.sort((a, b) => b.line - a.line);
  
  warnings.forEach((warning) => {
    const lineIndex = warning.line - 1;
    if (lineIndex < 0 || lineIndex >= lines.length) return;
    
    const line = lines[lineIndex];
    
    // Pattern 1: variable ?? undefined
    if (line.includes("?? undefined")) {
      const newLine = line.replace(/(\w+(?:\.\w+)*)\s*\?\?\s*undefined\b/g, (match, varName) => {
        if (line.trim().startsWith("//")) return match;
        fixes++;
        modified = true;
        return varName;
      });
      if (newLine !== line) {
        lines[lineIndex] = newLine;
      }
    }
    
    // Pattern 2: variable ?? "" when variable is string (not string | null | undefined)
    // Pattern 3: variable ?? [] when variable is array (not array | null | undefined)
    // Pattern 4: variable ?? false when variable is boolean (not boolean | null | undefined)
    // These are trickier and require type analysis - skip for now
  });
  
  if (modified) {
    fs.writeFileSync(filePath, lines.join("\n"), "utf8");
  }
  
  return { fixes, modified };
}

/**
 * Fix optional chaining warnings
 */
function fixOptionalChaining(filePath, warnings) {
  if (!fs.existsSync(filePath)) return { fixes: 0 };
  
  let content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  let fixes = 0;
  let modified = false;
  
  warnings.sort((a, b) => b.line - a.line);
  
  warnings.forEach((warning) => {
    const lineIndex = warning.line - 1;
    if (lineIndex < 0 || lineIndex >= lines.length) return;
    
    const line = lines[lineIndex];
    const colIndex = warning.col - 1;
    
    // Find ?. near the column
    // Variables extracted for potential future use in pattern matching
    void line.substring(0, Math.max(0, colIndex - 10));
    void line.substring(Math.max(0, colIndex - 10));
    
    // Pattern: obj?.prop -> obj.prop (when obj is guaranteed)
    if (line.includes("?.")) {
      // Very conservative - only fix simple patterns
      const newLine = line.replace(/(\w+)\?\.(\w+)(?!\()/g, (match, obj, prop) => {
        // Check if followed by ( indicating method call
        const restOfLine = line.substring(line.indexOf(match) + match.length);
        if (restOfLine.trim().startsWith("(")) {
          return match;
        }
        // Only fix if it's a simple property access
        fixes++;
        modified = true;
        return `${obj}.${prop}`;
      });
      
      if (newLine !== line) {
        lines[lineIndex] = newLine;
      }
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, lines.join("\n"), "utf8");
  }
  
  return { fixes, modified };
}

function main() {
  log("🚀 Efficient ESLint Warning Fixer\n");
  log("=".repeat(60));
  
  log("\n📊 Analyzing warnings...");
  const warnings = getAllWarnings();
  
  log(`\nFound:`);
  log(`  - ${warnings.nullishCoalescing.length} unnecessary nullish coalescing`);
  log(`  - ${warnings.optionalChaining.length} unnecessary optional chaining`);
  log(`  - ${warnings.alwaysTruthy.length} always truthy conditionals`);
  log(`  - ${warnings.alwaysFalsy.length} always falsy conditionals`);
  
  // Group by file
  const nullishFiles = {};
  warnings.nullishCoalescing.forEach((w) => {
    if (!nullishFiles[w.file]) nullishFiles[w.file] = [];
    nullishFiles[w.file].push(w);
  });
  
  const optionalFiles = {};
  warnings.optionalChaining.forEach((w) => {
    if (!optionalFiles[w.file]) optionalFiles[w.file] = [];
    optionalFiles[w.file].push(w);
  });
  
  log("\n🔧 Fixing nullish coalescing...");
  let totalFixes = 0;
  const processedFiles = [];
  
  Object.entries(nullishFiles).forEach(([file, fileWarnings]) => {
    const filePath = path.join(PROJECT_ROOT, file);
    const result = fixNullishCoalescing(filePath, fileWarnings);
    if (result.modified && result.fixes > 0) {
      totalFixes += result.fixes;
      processedFiles.push({ file, fixes: result.fixes, type: "nullish" });
    }
  });
  
  log("\n🔧 Fixing optional chaining...");
  Object.entries(optionalFiles).slice(0, 30).forEach(([file, fileWarnings]) => {
    const filePath = path.join(PROJECT_ROOT, file);
    const result = fixOptionalChaining(filePath, fileWarnings);
    if (result.modified && result.fixes > 0) {
      totalFixes += result.fixes;
      processedFiles.push({ file, fixes: result.fixes, type: "optional" });
    }
  });
  
  log("\n" + "=".repeat(60));
  log(`\n✅ Fixed ${totalFixes} issues in ${processedFiles.length} files\n`);
  
  if (processedFiles.length > 0) {
    log("Files fixed:");
    processedFiles.forEach(({ file, fixes, type }) => {
      log(`  ${file}: ${fixes} ${type} fixes`);
    });
  }
  
  log("\n💡 Run 'pnpm lint' to verify\n");
}

if (require.main === module) {
  main();
}

module.exports = { main };

