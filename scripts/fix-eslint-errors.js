#!/usr/bin/env node

/**
 * Script to auto-fix ESLint errors
 * 
 * This script:
 * 1. Runs ESLint with --fix to auto-fix what it can
 * 2. Applies custom fixes for patterns ESLint might miss
 * 3. Reports remaining errors
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
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Recursively find all TypeScript files
 */
function findTsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    // Skip node_modules, build, and other ignored directories
    if (stat.isDirectory()) {
      if (
        file === 'node_modules' ||
        file === 'build' ||
        file === '.git' ||
        file === 'public' ||
        file === 'postgres-data' ||
        file === 'redis-data' ||
        file.startsWith('.')
      ) {
        return;
      }
      findTsFiles(filePath, fileList);
    } else if (stat.isFile() && /\.(ts|tsx)$/.test(file)) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

/**
 * Run ESLint with --fix flag
 */
function runEslintFix() {
  log('\n🔧 Running ESLint auto-fix...', 'cyan');
  try {
    execSync('pnpm lint -- --fix', {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
    });
    log('✅ ESLint auto-fix completed', 'green');
    return true;
  } catch (error) {
    log('⚠️  ESLint auto-fix completed with some errors (this is expected)', 'yellow');
    return false;
  }
}

/**
 * Fix nullish coalescing: Replace || with ?? in safe contexts
 */
function fixNullishCoalescing(content) {
  let modified = false;
  let fixes = 0;


  // More conservative approach: only fix obvious cases
  // Pattern: variable || defaultValue where variable is optional
  const lines = content.split('\n');
  const newLines = lines.map((line) => {
    // Skip if line contains comments or complex expressions
    if (line.includes('//') || line.includes('/*')) {
      return line;
    }

    // Fix: (something?.prop || fallback) -> (something?.prop ?? fallback)
    if (line.includes('?.') && line.includes('||')) {
      const newLine = line.replace(
        /(\w+(?:\?\.\w+)+)\s*\|\|\s*([\w'"\[\]{}()]+)/g,
        (match, left, right) => {
          // Only if right is a simple value
          if (/^[\w'"\[\]{}()]+$/.test(right) && !right.includes('(') && !right.includes('[')) {
            modified = true;
            fixes++;
            return `${left} ?? ${right}`;
          }
          return match;
        }
      );
      return newLine;
    }

    // Fix: (variable || defaultValue) where variable could be null/undefined
    // Only for simple cases like: (user?.name || "Unknown")
    if (line.match(/\([^)]+\?\.[^)]+\)\s*\|\|/)) {
      const newLine = line.replace(
        /\(([^)]+)\?\.[^)]+\)\s*\|\|\s*([\w'"\[\]{}]+)/g,
        (match, prefix, right) => {
          if (/^[\w'"\[\]{}]+$/.test(right)) {
            modified = true;
            fixes++;
            return `(${prefix}?.${match.split('?.')[1].split(')')[0]}) ?? ${right}`;
          }
          return match;
        }
      );
      if (newLine !== line) return newLine;
    }

    return line;
  });

  if (modified) {
    return { content: newLines.join('\n'), fixes };
  }
  return { content, fixes: 0 };
}

/**
 * Fix import order (basic grouping)
 * NOTE: Disabled - ESLint's --fix handles this better
 */
function fixImportOrder_DISABLED(content) {
  const lines = content.split('\n');
  let importStart = -1;
  let importEnd = -1;
  let inImports = false;

  // Find import block
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('import ')) {
      if (!inImports) {
        inImports = true;
        importStart = i;
      }
      importEnd = i;
    } else if (inImports && line === '' && i > importEnd + 1) {
      break;
    } else if (inImports && line !== '' && !line.startsWith('import ')) {
      importEnd = i - 1;
      break;
    }
  }

  if (importStart < 0 || importEnd < importStart) {
    return { content, modified: false };
  }

  const importLines = lines.slice(importStart, importEnd + 1);
  const externalImports = [];
  const internalImports = [];
  const relativeImports = [];
  const typeImports = [];
  const sideEffectImports = [];

  importLines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('import type ')) {
      typeImports.push(line);
    } else if (trimmed.startsWith('import ') && trimmed.includes("from '~/") || trimmed.includes('from "~/')) {
      internalImports.push(line);
    } else if (trimmed.startsWith('import ') && (trimmed.includes("from './") || trimmed.includes('from "../'))) {
      relativeImports.push(line);
    } else if (trimmed.startsWith('import ') && !trimmed.includes(' from ')) {
      sideEffectImports.push(line);
    } else if (trimmed.startsWith('import ')) {
      externalImports.push(line);
    }
  });

  // Sort each group
  externalImports.sort();
  internalImports.sort();
  relativeImports.sort();
  typeImports.sort();
  sideEffectImports.sort();

  // Reconstruct with proper spacing
  const newImportLines = [];
  if (externalImports.length > 0) {
    newImportLines.push(...externalImports);
  }
  if (externalImports.length > 0 && (internalImports.length > 0 || relativeImports.length > 0 || typeImports.length > 0)) {
    newImportLines.push('');
  }
  if (internalImports.length > 0) {
    newImportLines.push(...internalImports);
  }
  if (internalImports.length > 0 && (relativeImports.length > 0 || typeImports.length > 0)) {
    newImportLines.push('');
  }
  if (relativeImports.length > 0) {
    newImportLines.push(...relativeImports);
  }
  if (relativeImports.length > 0 && typeImports.length > 0) {
    newImportLines.push('');
  }
  if (typeImports.length > 0) {
    newImportLines.push(...typeImports);
  }
  if (sideEffectImports.length > 0) {
    if (newImportLines.length > 0) newImportLines.push('');
    newImportLines.push(...sideEffectImports);
  }

  // Check if anything changed
  const originalBlock = importLines.join('\n');
  const newBlock = newImportLines.join('\n');
  if (originalBlock === newBlock) {
    return { content, modified: false };
  }

  const newContent = [
    ...lines.slice(0, importStart),
    ...newImportLines,
    ...lines.slice(importEnd + 1),
  ].join('\n');

  return { content: newContent, modified: true };
}

/**
 * Remove async from functions without await
 */
function removeUnnecessaryAsync(content) {
  let modified = false;
  let fixes = 0;

  // Pattern: export async function name(): Promise<T> { ... } without await
  const asyncFuncRegex = /export\s+async\s+function\s+(\w+)\s*\([^)]*\)\s*:\s*Promise<[^>]+>\s*\{([^}]*)\}/gs;
  
  content = content.replace(asyncFuncRegex, (match, funcName, body) => {
    // Check if body contains await, Promise methods, or async operations
    if (
      !body.includes('await') &&
      !body.includes('Promise.') &&
      !body.includes('async') &&
      !body.includes('then(') &&
      !body.includes('catch(')
    ) {
      modified = true;
      fixes++;
      return match.replace(/\basync\s+/, '');
    }
    return match;
  });

  return { content, modified, fixes };
}

/**
 * Apply custom fixes to a file
 */
function applyCustomFixes(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let totalFixes = 0;
    let modified = false;

    // Fix 1: Nullish coalescing
    const nullishResult = fixNullishCoalescing(content);
    if (nullishResult.fixes > 0) {
      content = nullishResult.content;
      totalFixes += nullishResult.fixes;
      modified = true;
    }

    // Note: Import order is handled by ESLint's --fix, so we skip custom import order fixes
    // to avoid conflicts with ESLint's more sophisticated rules

    // Fix 2: Remove unnecessary async
    const asyncResult = removeUnnecessaryAsync(content);
    if (asyncResult.modified) {
      content = asyncResult.content;
      totalFixes += asyncResult.fixes;
      modified = true;
    }


    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      return { fixed: true, fixes: totalFixes };
    }

    return { fixed: false, fixes: 0 };
  } catch (error) {
    log(`  ⚠️  Error processing ${path.relative(PROJECT_ROOT, filePath)}: ${error.message}`, 'yellow');
    return { fixed: false, fixes: 0, error: error.message };
  }
}

/**
 * Apply custom fixes to all files
 */
function applyCustomFixesToAll() {
  log('\n🔧 Applying custom fixes...', 'cyan');
  
  const targetDirs = [
    path.join(PROJECT_ROOT, 'app'),
    path.join(PROJECT_ROOT, 'tests'),
    path.join(PROJECT_ROOT, 'cypress'),
  ];

  let filesFixed = 0;
  let totalFixes = 0;

  targetDirs.forEach((dir) => {
    if (!fs.existsSync(dir)) return;

    const files = findTsFiles(dir);
    files.forEach((filePath) => {
      const result = applyCustomFixes(filePath);
      if (result.fixed) {
        filesFixed++;
        totalFixes += result.fixes;
      }
    });
  });

  if (filesFixed > 0) {
    log(`✅ Custom fixes applied to ${filesFixed} files (${totalFixes} total fixes)`, 'green');
  } else {
    log('ℹ️  No custom fixes needed', 'blue');
  }

  return filesFixed;
}

/**
 * Count remaining errors
 */
function countRemainingErrors() {
  log('\n📊 Counting remaining errors...', 'cyan');
  try {
    const output = execSync('pnpm lint 2>&1', {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
    });
    
    const errorMatches = output.match(/\d+:\d+\s+error/g);
    const warningMatches = output.match(/\d+:\d+\s+warning/g);
    
    const errorCount = errorMatches ? errorMatches.length : 0;
    const warningCount = warningMatches ? warningMatches.length : 0;

    log(`\n📈 Results:`, 'cyan');
    log(`   Errors: ${errorCount}`, errorCount > 0 ? 'red' : 'green');
    log(`   Warnings: ${warningCount}`, warningCount > 0 ? 'yellow' : 'green');

    return { errors: errorCount, warnings: warningCount };
  } catch (error) {
    // ESLint returns non-zero exit code when there are errors
    const output = error.stdout || error.message || '';
    const errorMatches = output.match(/\d+:\d+\s+error/g);
    const warningMatches = output.match(/\d+:\d+\s+warning/g);
    
    const errorCount = errorMatches ? errorMatches.length : 0;
    const warningCount = warningMatches ? warningMatches.length : 0;

    log(`\n📈 Results:`, 'cyan');
    log(`   Errors: ${errorCount}`, errorCount > 0 ? 'red' : 'green');
    log(`   Warnings: ${warningCount}`, warningCount > 0 ? 'yellow' : 'green');

    return { errors: errorCount, warnings: warningCount };
  }
}

/**
 * Main execution
 */
function main() {
  log('🚀 Starting ESLint auto-fix script...', 'blue');
  log('='.repeat(60), 'cyan');

  // Step 1: Run ESLint auto-fix
  runEslintFix();

  // Step 2: Apply custom fixes
  applyCustomFixesToAll();

  // Step 3: Count remaining errors
  const counts = countRemainingErrors();

  log('\n' + '='.repeat(60), 'cyan');
  if (counts.errors === 0) {
    log('🎉 All errors fixed!', 'green');
  } else {
    log(`⚠️  ${counts.errors} errors remaining (these may require manual fixes)`, 'yellow');
    log('💡 Run "pnpm lint" to see details', 'blue');
  }

  process.exit(counts.errors > 0 ? 1 : 0);
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { main, countRemainingErrors, applyCustomFixesToAll };
