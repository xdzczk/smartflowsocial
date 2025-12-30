#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const REPORT_FILE = path.join(PROJECT_ROOT, 'eslint-report.json');

try {
  const reportContent = fs.readFileSync(REPORT_FILE, 'utf8');
  const report = JSON.parse(reportContent);

  const errors = [];

  report.forEach((file) => {
    if (file.errorCount > 0) {
      file.messages.forEach((message) => {
        if (
          message.severity === 2 &&
          (message.ruleId === '@typescript-eslint/no-unnecessary-type-assertion' ||
            message.ruleId === '@typescript-eslint/consistent-type-assertions')
        ) {
          const filePath = file.filePath.replace(PROJECT_ROOT + '/', '');
          errors.push({
            file: filePath,
            rule: message.ruleId,
            line: message.line,
            column: message.column,
            message: message.message,
          });
        }
      });
    }
  });

  console.log(`Found ${errors.length} type assertion errors:\n`);
  errors.forEach((e) => {
    console.log(`${e.file}:${e.line}:${e.column}`);
    console.log(`  Rule: ${e.rule}`);
    console.log(`  Message: ${e.message}`);
    console.log('');
  });

  // Group by file
  const byFile = {};
  errors.forEach((e) => {
    if (!byFile[e.file]) {
      byFile[e.file] = [];
    }
    byFile[e.file].push(e);
  });

  console.log('\nFiles with errors:');
  Object.keys(byFile).forEach((file) => {
    console.log(`  ${file}: ${byFile[file].length} error(s)`);
  });
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}


