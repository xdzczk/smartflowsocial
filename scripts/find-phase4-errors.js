#!/usr/bin/env node

/**
 * Find files with Phase 4 errors (remaining errors)
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const REPORT_FILE = path.join(PROJECT_ROOT, 'eslint-report.json');

// Patterns to identify test/script files
const TEST_SCRIPT_PATTERNS = [
  /tests\//,
  /cypress\//,
  /scripts\//,
  /\.test\./,
  /\.spec\./,
  /\.config\./,
  /mocks\//,
  /seed/,
  /factory/,
];

function isTestOrScript(filePath) {
  return TEST_SCRIPT_PATTERNS.some(pattern => pattern.test(filePath));
}

// Phase 4 error types
const PHASE4_ERRORS = [
  'no-constant-binary-expression',
  '@typescript-eslint/no-unnecessary-type-assertion',
  'import/order',
  '@typescript-eslint/consistent-type-assertions',
];

function findPhase4Errors() {
  try {
    const reportContent = fs.readFileSync(REPORT_FILE, 'utf8');
    const report = JSON.parse(reportContent);

    const filesWithErrors = new Map();

    report.forEach((file) => {
      const filePath = file.filePath.replace(PROJECT_ROOT + '/', '');
      if (isTestOrScript(filePath)) return; // Skip test/script files

      const phase4Errors = file.messages.filter(msg => 
        msg.severity === 2 && (PHASE4_ERRORS.includes(msg.ruleId) || !msg.ruleId)
      );

      if (phase4Errors.length > 0) {
        filesWithErrors.set(filePath, {
          path: filePath,
          errors: phase4Errors,
          count: phase4Errors.length,
        });
      }
    });

    // Sort by error count (descending)
    const sorted = Array.from(filesWithErrors.values())
      .sort((a, b) => b.count - a.count);

    console.log('\n🔍 Phase 4 Errors Found (Remaining Errors):\n');
    console.log('='.repeat(80));
    
    // Group by error type
    const byType = new Map();
    sorted.forEach(file => {
      file.errors.forEach(error => {
        const ruleId = error.ruleId || 'unknown';
        if (!byType.has(ruleId)) {
          byType.set(ruleId, []);
        }
        byType.get(ruleId).push({
          file: file.path,
          line: error.line,
          column: error.column,
          message: error.message,
        });
      });
    });

    // Display by error type
    Array.from(byType.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([ruleId, errors]) => {
        console.log(`\n📌 ${ruleId} (${errors.length} errors):\n`);
        errors.forEach(err => {
          console.log(`   ${err.file}:${err.line}:${err.column} - ${err.message}`);
        });
      });

    console.log('\n' + '='.repeat(80));
    console.log(`\n📁 Files with Phase 4 errors: ${sorted.length}`);
    console.log(`📊 Total Phase 4 errors: ${sorted.reduce((sum, f) => sum + f.count, 0)}\n`);

    // Show all files
    console.log('Files to fix:\n');
    sorted.forEach((file, idx) => {
      console.log(`  ${idx + 1}. ${file.path} (${file.count} errors)`);
    });

    return sorted;
  } catch (error) {
    console.error('Error reading eslint-report.json:', error.message);
    console.log('\n💡 Run: pnpm lint (to generate the report)');
    process.exit(1);
  }
}

if (require.main === module) {
  findPhase4Errors();
}

module.exports = { findPhase4Errors };





