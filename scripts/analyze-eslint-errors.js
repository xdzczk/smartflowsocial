#!/usr/bin/env node

/**
 * Analyze ESLint errors and warnings by location (production vs tests/scripts)
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

function analyzeReport() {
  try {
    const reportContent = fs.readFileSync(REPORT_FILE, 'utf8');
    const report = JSON.parse(reportContent);

    let prodErrors = 0;
    let prodWarnings = 0;
    let testErrors = 0;
    let testWarnings = 0;
    let prodFiles = new Set();
    let testFiles = new Set();

    report.forEach((file) => {
      const filePath = file.filePath.replace(PROJECT_ROOT + '/', '');
      const isTest = isTestOrScript(filePath);

      if (isTest) {
        testErrors += file.errorCount;
        testWarnings += file.warningCount;
        if (file.errorCount > 0 || file.warningCount > 0) {
          testFiles.add(filePath);
        }
      } else {
        prodErrors += file.errorCount;
        prodWarnings += file.warningCount;
        if (file.errorCount > 0 || file.warningCount > 0) {
          prodFiles.add(filePath);
        }
      }
    });

    console.log('\n📊 ESLint Issues Breakdown\n');
    console.log('='.repeat(60));
    console.log('\n🔴 ERRORS:');
    console.log(`   Production code: ${prodErrors}`);
    console.log(`   Tests/Scripts:   ${testErrors}`);
    console.log(`   Total:           ${prodErrors + testErrors}`);

    console.log('\n⚠️  WARNINGS:');
    console.log(`   Production code: ${prodWarnings}`);
    console.log(`   Tests/Scripts:   ${testWarnings}`);
    console.log(`   Total:           ${prodWarnings + testWarnings}`);

    console.log('\n📁 FILES WITH ISSUES:');
    console.log(`   Production files: ${prodFiles.size}`);
    console.log(`   Test/script files: ${testFiles.size}`);
    console.log(`   Total:            ${prodFiles.size + testFiles.size}`);

    console.log('\n' + '='.repeat(60));
    console.log('\n💡 Summary:');
    const prodPercent = ((prodErrors + prodWarnings) / (prodErrors + prodWarnings + testErrors + testWarnings) * 100).toFixed(1);
    const testPercent = ((testErrors + testWarnings) / (prodErrors + prodWarnings + testErrors + testWarnings) * 100).toFixed(1);
    console.log(`   ${prodPercent}% in production code`);
    console.log(`   ${testPercent}% in tests/scripts`);
    console.log('');

    return {
      prodErrors,
      prodWarnings,
      testErrors,
      testWarnings,
      prodFiles: prodFiles.size,
      testFiles: testFiles.size,
    };
  } catch (error) {
    console.error('Error reading eslint-report.json:', error.message);
    console.log('\n💡 Run: pnpm exec eslint --format json . > eslint-report.json');
    process.exit(1);
  }
}

if (require.main === module) {
  analyzeReport();
}

module.exports = { analyzeReport };









