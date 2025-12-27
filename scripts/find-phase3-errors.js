#!/usr/bin/env node

/**
 * Find files with Phase 3 errors (async/promise issues)
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

// Phase 3 error types
const PHASE3_ERRORS = [
  '@typescript-eslint/no-floating-promises',
  '@typescript-eslint/no-misused-promises',
];

function findPhase3Errors() {
  try {
    const reportContent = fs.readFileSync(REPORT_FILE, 'utf8');
    const report = JSON.parse(reportContent);

    const filesWithErrors = new Map();

    report.forEach((file) => {
      const filePath = file.filePath.replace(PROJECT_ROOT + '/', '');
      if (isTestOrScript(filePath)) return; // Skip test/script files

      const phase3Errors = file.messages.filter(msg => 
        msg.severity === 2 && PHASE3_ERRORS.includes(msg.ruleId)
      );

      if (phase3Errors.length > 0) {
        filesWithErrors.set(filePath, {
          path: filePath,
          errors: phase3Errors,
          count: phase3Errors.length,
        });
      }
    });

    // Sort by error count (descending)
    const sorted = Array.from(filesWithErrors.values())
      .sort((a, b) => b.count - a.count);

    console.log('\n🔍 Phase 3 Errors Found (Async/Promise Issues):\n');
    console.log('='.repeat(80));
    
    // Group by error type
    const byType = new Map();
    sorted.forEach(file => {
      file.errors.forEach(error => {
        if (!byType.has(error.ruleId)) {
          byType.set(error.ruleId, []);
        }
        byType.get(error.ruleId).push({
          file: file.path,
          line: error.line,
          column: error.column,
          message: error.message,
        });
      });
    });

    // Display by error type
    PHASE3_ERRORS.forEach(ruleId => {
      const errors = byType.get(ruleId) || [];
      if (errors.length > 0) {
        console.log(`\n📌 ${ruleId} (${errors.length} errors):\n`);
        errors.forEach(err => {
          console.log(`   ${err.file}:${err.line}:${err.column} - ${err.message}`);
        });
      }
    });

    console.log('\n' + '='.repeat(80));
    console.log(`\n📁 Files with Phase 3 errors: ${sorted.length}`);
    console.log(`📊 Total Phase 3 errors: ${sorted.reduce((sum, f) => sum + f.count, 0)}\n`);

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
  findPhase3Errors();
}

module.exports = { findPhase3Errors };

