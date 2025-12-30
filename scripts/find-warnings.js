#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const REPORT_FILE = path.join(PROJECT_ROOT, 'eslint-report.json');

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

function findWarnings(ruleId) {
  console.log(`\n🔍 Finding ${ruleId} warnings in production code...\n`);

  let reportContent;
  try {
    reportContent = fs.readFileSync(REPORT_FILE, 'utf8');
    JSON.parse(reportContent); // Test if valid JSON
  } catch (readError) {
    console.log('⚠️  Generating ESLint report...\n');
    execSync('pnpm exec eslint --format json . > eslint-report.json', {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
    });
    reportContent = fs.readFileSync(REPORT_FILE, 'utf8');
  }

  const report = JSON.parse(reportContent);
  const warnings = [];

  report.forEach((file) => {
    const filePath = file.filePath.replace(PROJECT_ROOT + '/', '');
    if (isTestOrScript(filePath)) return;

    file.messages.forEach((message) => {
      if (message.severity === 1 && message.ruleId === ruleId) {
        warnings.push({
          file: filePath,
          line: message.line,
          column: message.column,
          message: message.message,
        });
      }
    });
  });

  console.log(`Found ${warnings.length} warnings:\n`);
  warnings.forEach((w, i) => {
    console.log(`${i + 1}. ${w.file}:${w.line}:${w.column}`);
    console.log(`   ${w.message}\n`);
  });

  return warnings;
}

const ruleId = process.argv[2];
if (!ruleId) {
  console.log('Usage: node scripts/find-warnings.js <rule-id>');
  console.log('\nExample: node scripts/find-warnings.js @typescript-eslint/prefer-nullish-coalescing');
  process.exit(1);
}

findWarnings(ruleId);

