#!/usr/bin/env node

/**
 * Comprehensive ESLint Error Fixer
 * 
 * This script systematically fixes all ESLint errors by:
 * 1. Running ESLint --fix for auto-fixable issues
 * 2. Applying pattern-based fixes for common error types
 * 3. Processing files with the most errors first
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Get list of files with errors and their counts
 */
function getFilesWithErrors() {
  log('\n📋 Analyzing error distribution...', 'cyan');
  
  try {
    const output = execSync('pnpm lint 2>&1', {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
    });
    
    const fileErrors = new Map();
    let currentFile = null;
    
    const lines = output.split('\n');
    for (const line of lines) {
      // Check if line is a file path
      if (line.match(/^\/.*\.(ts|tsx)$/)) {
        currentFile = line.trim();
        if (!fileErrors.has(currentFile)) {
          fileErrors.set(currentFile, 0);
        }
      }
      // Count errors for current file
      if (currentFile && line.match(/\d+:\d+\s+error/)) {
        fileErrors.set(currentFile, fileErrors.get(currentFile) + 1);
      }
    }
    
    // Sort by error count (descending)
    const sorted = Array.from(fileErrors.entries())
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);
    
    return sorted;
  } catch (error) {
    const output = error.stdout || error.message || '';
    const fileErrors = new Map();
    let currentFile = null;
    
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.match(/^\/.*\.(ts|tsx)$/)) {
        currentFile = line.trim();
        if (!fileErrors.has(currentFile)) {
          fileErrors.set(currentFile, 0);
        }
      }
      if (currentFile && line.match(/\d+:\d+\s+error/)) {
        fileErrors.set(currentFile, fileErrors.get(currentFile) + 1);
      }
    }
    
    const sorted = Array.from(fileErrors.entries())
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);
    
    return sorted;
  }
}

/**
 * Fix unsafe any assignments by adding proper type guards
 */
function fixUnsafeAssignments(content, filePath) {
  let modified = false;
  let fixes = 0;
  const lines = content.split('\n');
  const newLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const originalLine = line;
    
    // Pattern: const x = y as any; -> const x: Type = y;
    // This is complex and requires understanding the context, so we'll skip for now
    
    // Pattern: Fix unsafe member access with optional chaining
    // x.y where x is any -> x?.y with proper type guard
    if (line.includes('any') && line.match(/\.\w+\s*[=;,\\)]/)) {
      // This requires more context, skip for now
    }
    
    newLines.push(line);
    if (line !== originalLine) {
      modified = true;
      fixes++;
    }
  }
  
  return { content: modified ? newLines.join('\n') : content, modified, fixes };
}

/**
 * Fix unnecessary type assertions
 */
function fixUnnecessaryTypeAssertions(content) {
  let modified = false;
  let fixes = 0;
  
  // Pattern: x as Type where Type is already inferred
  // This is complex and requires type checking, so we'll be conservative
  
  // Pattern: const x = { ... } as Type -> const x: Type = { ... }
  content = content.replace(
    /const\s+(\w+)\s*=\s*(\{[^}]+\})\s+as\s+(\w+)/g,
    (match, varName, obj, type) => {
      modified = true;
      fixes++;
      return `const ${varName}: ${type} = ${obj}`;
    }
  );
  
  return { content, modified, fixes };
}

/**
 * Fix floating promises
 */
function fixFloatingPromises(content) {
  let modified = false;
  let fixes = 0;
  const lines = content.split('\n');
  const newLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Pattern: functionCall(); where functionCall returns Promise
    // Add void operator: void functionCall();
    // But be careful - only if it's a standalone statement
    if (line.match(/^\s*[a-zA-Z_$][\w$]*\([^)]*\)\s*;?\s*$/)) {
      // Check if previous line suggests it's a promise
      const prevLine = i > 0 ? lines[i - 1] : '';
      if (prevLine.includes('await') || prevLine.includes('Promise')) {
        // This might be a floating promise
        // But we need to be careful - only fix if we're sure
      }
    }
    
    newLines.push(line);
  }
  
  return { content: modified ? newLines.join('\n') : content, modified, fixes };
}

/**
 * Fix misused promises in event handlers
 */
function fixMisusedPromises(content) {
  let modified = false;
  let fixes = 0;
  
  // Pattern: onClick={asyncFunction} -> onClick={() => { void asyncFunction(); }}
  // Pattern: onSubmit={asyncFunction} -> onSubmit={() => { void asyncFunction(); }}
  const eventHandlerPatterns = [
    /on(Click|Submit|Change|Focus|Blur)\s*=\s*\{([^}]+)\}/g,
  ];
  
  for (const pattern of eventHandlerPatterns) {
    content = content.replace(pattern, (match, event, handler) => {
      // Check if handler is an async function call
      if (handler.match(/^\s*\w+\s*\(/)) {
        modified = true;
        fixes++;
        return `on${event}={() => { void ${handler.trim()}(); }}`;
      }
      return match;
    });
  }
  
  return { content, modified, fixes };
}

/**
 * Fix restrict-template-expressions
 */
function fixTemplateExpressions(content) {
  let modified = false;
  let fixes = 0;
  
  // Pattern: `${x}` where x is any -> `${String(x ?? '')}`
  // But this is risky - we need to be more conservative
  // Only fix obvious cases where we know it's safe
  
  return { content, modified, fixes };
}

/**
 * Fix require-await
 */
function fixRequireAwait(content) {
  let modified = false;
  let fixes = 0;
  
  // Pattern: async function x() { return y; } -> function x() { return y; }
  // We already have this in the main fix script, but let's ensure it's comprehensive
  content = content.replace(
    /export\s+async\s+function\s+(\w+)\s*\([^)]*\)\s*:\s*Promise<[^>]+>\s*\{([^}]*return[^}]*)\}/gs,
    (match, funcName, body) => {
      if (!body.includes('await') && !body.includes('Promise.')) {
        modified = true;
        fixes++;
        return match.replace(/\basync\s+/, '');
      }
      return match;
    }
  );
  
  return { content, modified, fixes };
}

/**
 * Process a single file to fix errors
 */
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let totalFixes = 0;
    let modified = false;
    
    // Apply all fixes
    const fixes = [
      fixUnnecessaryTypeAssertions(content),
      fixMisusedPromises(content),
      fixRequireAwait(content),
    ];
    
    for (const fix of fixes) {
      if (fix.modified) {
        content = fix.content;
        totalFixes += fix.fixes;
        modified = true;
      }
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      
      // Run ESLint --fix on this file
      try {
        execSync(`npx eslint --fix "${filePath}"`, {
          cwd: PROJECT_ROOT,
          stdio: 'ignore',
        });
      } catch {
        // Ignore - file might have other issues
      }
      
      return { fixed: true, fixes: totalFixes };
    }
    
    return { fixed: false, fixes: 0 };
  } catch (error) {
    return { fixed: false, fixes: 0, error: error.message };
  }
}

/**
 * Main execution
 */
function main() {
  log('🚀 Starting comprehensive ESLint error fix...', 'blue');
  log('='.repeat(60), 'cyan');
  
  // Step 1: Run ESLint --fix globally
  log('\n🔧 Step 1: Running ESLint auto-fix...', 'cyan');
  try {
    execSync('pnpm lint -- --fix', {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
    });
  } catch {
    // Expected - there will be errors
  }
  
  // Step 2: Get files with errors
  const filesWithErrors = getFilesWithErrors();
  log(`\n📊 Found ${filesWithErrors.length} files with errors`, 'cyan');
  
  if (filesWithErrors.length > 0) {
    log(`\n🔧 Step 2: Processing files (starting with highest error count)...`, 'cyan');
    log(`Top 10 files:`, 'yellow');
    filesWithErrors.slice(0, 10).forEach(([file, count]) => {
      log(`  ${count} errors: ${path.relative(PROJECT_ROOT, file)}`, 'yellow');
    });
    
    let totalFilesFixed = 0;
    let totalFixes = 0;
    
    // Process files in batches
    const BATCH_SIZE = 10;
    for (let i = 0; i < filesWithErrors.length; i += BATCH_SIZE) {
      const batch = filesWithErrors.slice(i, i + BATCH_SIZE);
      log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} files)...`, 'cyan');
      
      for (const [filePath, errorCount] of batch) {
        const result = processFile(filePath);
        if (result.fixed) {
          totalFilesFixed++;
          totalFixes += result.fixes;
          log(`  ✅ Fixed ${result.fixes} issues in ${path.relative(PROJECT_ROOT, filePath)}`, 'green');
        }
      }
      
      // Re-run ESLint --fix after each batch
      try {
        execSync('pnpm lint -- --fix', {
          cwd: PROJECT_ROOT,
          stdio: 'ignore',
        });
      } catch {
        // Expected
      }
    }
    
    log(`\n✅ Fixed ${totalFixes} issues across ${totalFilesFixed} files`, 'green');
  }
  
  // Step 3: Count remaining errors
  log('\n📊 Step 3: Counting remaining errors...', 'cyan');
  try {
    const output = execSync('pnpm lint 2>&1', {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
    });
    
    const errorMatches = output.match(/\d+:\d+\s+error/g);
    const warningMatches = output.match(/\d+:\d+\s+warning/g);
    
    const errorCount = errorMatches ? errorMatches.length : 0;
    const warningCount = warningMatches ? warningMatches.length : 0;
    
    log(`\n📈 Final Results:`, 'cyan');
    log(`   Errors: ${errorCount}`, errorCount > 0 ? 'red' : 'green');
    log(`   Warnings: ${warningCount}`, warningCount > 0 ? 'yellow' : 'green');
    
    return { errors: errorCount, warnings: warningCount };
  } catch (error) {
    const output = error.stdout || error.message || '';
    const errorMatches = output.match(/\d+:\d+\s+error/g);
    const warningMatches = output.match(/\d+:\d+\s+warning/g);
    
    const errorCount = errorMatches ? errorMatches.length : 0;
    const warningCount = warningMatches ? warningMatches.length : 0;
    
    log(`\n📈 Final Results:`, 'cyan');
    log(`   Errors: ${errorCount}`, errorCount > 0 ? 'red' : 'green');
    log(`   Warnings: ${warningCount}`, warningCount > 0 ? 'yellow' : 'green');
    
    return { errors: errorCount, warnings: warningCount };
  }
}

if (require.main === module) {
  const results = main();
  log('\n' + '='.repeat(60), 'cyan');
  if (results.errors === 0) {
    log('🎉 All errors fixed!', 'green');
    process.exit(0);
  } else {
    log(`⚠️  ${results.errors} errors remaining`, 'yellow');
    log('💡 Some errors require manual fixes (unsafe any, complex type issues)', 'blue');
    process.exit(1);
  }
}

module.exports = { main };



