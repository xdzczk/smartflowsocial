#!/usr/bin/env node

/**
 * Precise fix for unnecessary optional chaining
 * Uses ESLint's exact line/column positions
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");

function log(message) {
  console.log(message);
}

function main() {
  log("🔍 Finding and fixing unnecessary optional chaining...\n");
  
  // Get ESLint output
  let lintOutput;
  try {
    lintOutput = execSync(
      `pnpm lint 2>&1`,
      { cwd: PROJECT_ROOT, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
    );
  } catch (error) {
    lintOutput = error.stdout || error.message || "";
  }
  
  // Parse warnings
  const warnings = [];
  const lines = lintOutput.split("\n");
  let currentFile = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("/") && (line.includes(".ts") || line.includes(".tsx"))) {
      currentFile = line.trim();
    }
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
  
  log(`Found ${warnings.length} unnecessary optional chaining warnings\n`);
  
  // Group by file
  const filesMap = {};
  warnings.forEach((w) => {
    if (!filesMap[w.file]) {
      filesMap[w.file] = [];
    }
    filesMap[w.file].push(w);
  });
  
  let totalFixes = 0;
  const processedFiles = [];
  
  Object.entries(filesMap).forEach(([file, fileWarnings]) => {
    const filePath = path.join(PROJECT_ROOT, file);
    if (!fs.existsSync(filePath)) return;
    
    try {
      let content = fs.readFileSync(filePath, "utf8");
      const lines = content.split("\n");
      let modified = false;
      let fixes = 0;
      
      // Sort warnings by line number (descending) to avoid offset issues
      fileWarnings.sort((a, b) => b.line - a.line);
      
      fileWarnings.forEach((warning) => {
        const lineIndex = warning.line - 1;
        if (lineIndex < 0 || lineIndex >= lines.length) return;
        
        const line = lines[lineIndex];
        const colIndex = warning.col - 1;
        
        if (colIndex >= line.length) return;
        
        // Find the ?. at or near this column
        // Look for ?. pattern starting from the column position
        // Variables extracted for potential future use in pattern matching
        void line.substring(0, colIndex);
        void line.substring(colIndex);
        
        // Find the ?. pattern
        const optionalMatch = atCol.match(/^[^?]*(\w+)\?\.(\w+)/);
        if (optionalMatch) {
          const obj = optionalMatch[1];
          const prop = optionalMatch[2];
          const fullMatch = `${obj}?.${prop}`;
          
          // Check if it's safe to remove (not a method call)
          const afterMatch = atCol.substring(atCol.indexOf(fullMatch) + fullMatch.length);
          if (!afterMatch.trim().startsWith("(")) {
            // Safe to fix
            const newLine = line.replace(new RegExp(`\\b${obj}\\?\\.${prop}\\b`, "g"), `${obj}.${prop}`);
            if (newLine !== line) {
              lines[lineIndex] = newLine;
              fixes++;
              modified = true;
            }
          }
        } else {
          // Try a simpler approach - find ?. near the column
          const simpleMatch = line.substring(Math.max(0, colIndex - 10), colIndex + 10).match(/(\w+)\?\.(\w+)/);
          if (simpleMatch) {
            const obj = simpleMatch[1];
            const prop = simpleMatch[2];
            const afterMatch = line.substring(colIndex + 10);
            if (!afterMatch.trim().startsWith("(")) {
              const newLine = line.replace(new RegExp(`\\b${obj}\\?\\.${prop}\\b`, "g"), `${obj}.${prop}`);
              if (newLine !== line) {
                lines[lineIndex] = newLine;
                fixes++;
                modified = true;
              }
            }
          }
        }
      });
      
      if (modified) {
        fs.writeFileSync(filePath, lines.join("\n"), "utf8");
        totalFixes += fixes;
        processedFiles.push({ file, fixes });
      }
    } catch (error) {
      log(`  ⚠️  Error processing ${file}: ${error.message}`);
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

