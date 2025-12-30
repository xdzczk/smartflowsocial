#!/usr/bin/env node

/**
 * Find remaining ESLint errors in production code
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const REPORT_FILE = path.join(PROJECT_ROOT, 'eslint-report.json');

function isTestOrScript(filePath) {
  return (
    filePath.includes('/tests/') ||
    filePath.includes('/test/') ||
    filePath.includes('/scripts/') ||
    filePath.includes('/cypress/') ||
    filePath.includes('.test.') ||
    filePath.includes('.spec.') ||
    filePath.includes('/mocks/') ||
    filePath.includes('/seed') ||
    filePath.includes('/factory')
  );
}

function findRemainingErrors() {
  console.log('🔍 Finding remaining ESLint errors in production code...\n');

  try {
    let reportContent;
    try {
      reportContent = fs.readFileSync(REPORT_FILE, 'utf8');
    } catch (readError) {
      console.log('⚠️  eslint-report.json does not exist. Generating...\n');
      const output = execSync('pnpm exec eslint --format json .', {
        cwd: PROJECT_ROOT,
        encoding: 'utf8',
      });
      fs.writeFileSync(REPORT_FILE, output, 'utf8');
      reportContent = output;
    }

    let report;
    try {
      report = JSON.parse(reportContent);
    } catch (parseError) {
      console.log('⚠️  eslint-report.json is not valid JSON. Regenerating...\n');
      const output = execSync('pnpm exec eslint --format json .', {
        cwd: PROJECT_ROOT,
        encoding: 'utf8',
      });
      fs.writeFileSync(REPORT_FILE, output, 'utf8');
      reportContent = output;
      report = JSON.parse(reportContent);
    }

    const errorsByRule = new Map();
    const errorsByFile = [];

    report.forEach((file) => {
      const filePath = file.filePath.replace(PROJECT_ROOT + '/', '');
      const isTest = isTestOrScript(filePath);

      if (!isTest && file.errorCount > 0) {
        const fileErrors = [];
        file.messages.forEach((message) => {
          if (message.severity === 2) { // Error
            const ruleId = message.ruleId || 'unknown';
            errorsByRule.set(ruleId, (errorsByRule.get(ruleId) || 0) + 1);
            fileErrors.push({
              rule: ruleId,
              line: message.line,
              column: message.column,
              message: message.message,
            });
          }
        });

        if (fileErrors.length > 0) {
          errorsByFile.push({
            file: filePath,
            errors: fileErrors,
          });
        }
      }
    });

    console.log('📊 Remaining Errors by Rule:\n');
    console.log('='.repeat(70));
    Array.from(errorsByRule.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([rule, count]) => {
        console.log(`  ${count.toString().padStart(3)}  ${rule}`);
      });

    console.log('\n\n📁 Files with Errors:\n');
    console.log('='.repeat(70));
    errorsByFile.forEach(({ file, errors }) => {
      console.log(`\n${file}:`);
      errors.forEach(({ rule, line, column, message }) => {
        console.log(`  Line ${line}:${column} - ${rule}`);
        console.log(`    ${message}`);
      });
    });

    console.log('\n' + '='.repeat(70));
    console.log(`\nTotal: ${errorsByFile.reduce((sum, f) => sum + f.errors.length, 0)} errors in ${errorsByFile.length} files\n`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  findRemainingErrors();
}

