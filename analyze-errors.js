const fs = require('fs');
const data = JSON.parse(fs.readFileSync('eslint-report.json', 'utf8'));
const rules = {};

data.forEach(f => {
  if (!f.filePath.includes('/tests/') && !f.filePath.includes('/test/')) {
    f.messages.forEach(m => {
      if (m.severity === 2) {
        rules[m.ruleId || 'unknown'] = (rules[m.ruleId || 'unknown'] || 0) + 1;
      }
    });
  }
});

const sorted = Object.entries(rules).sort((a, b) => b[1] - a[1]);
console.log('Top error rules in non-test files:');
sorted.slice(0, 10).forEach(([r, c]) => console.log(r + ':', c));
console.log('\nTotal non-test errors:', Object.values(rules).reduce((a, b) => a + b, 0));

