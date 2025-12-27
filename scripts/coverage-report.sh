#!/bin/bash
# Coverage reporting script
# Generates coverage reports and tracks coverage trends

set -e

echo "📊 Generating Coverage Report..."

# Run tests with coverage
npm run test:coverage

# Generate summary
echo ""
echo "📈 Coverage Summary:"
echo "===================="

# Extract coverage from JSON summary if available
if [ -f "coverage/coverage-summary.json" ]; then
  echo "✅ Coverage report generated: coverage/coverage-summary.json"
  echo "📄 HTML report: coverage/index.html"
  echo ""
  echo "Coverage thresholds:"
  echo "  - Lines: 70%"
  echo "  - Functions: 65%"
  echo "  - Branches: 60%"
  echo "  - Statements: 70%"
fi

# Check if coverage meets thresholds
if [ -f "coverage/coverage-summary.json" ]; then
  echo ""
  echo "Checking coverage thresholds..."
  node -e "
    const fs = require('fs');
    const coverage = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf8'));
    const total = coverage.total;
    
    const thresholds = {
      lines: 70,
      functions: 65,
      branches: 60,
      statements: 70
    };
    
    let passed = true;
    for (const [metric, threshold] of Object.entries(thresholds)) {
      const actual = total[metric].pct;
      const status = actual >= threshold ? '✅' : '❌';
      console.log(\`  \${status} \${metric}: \${actual.toFixed(2)}% (threshold: \${threshold}%)\`);
      if (actual < threshold) passed = false;
    }
    
    process.exit(passed ? 0 : 1);
  "
  
  if [ $? -eq 0 ]; then
    echo ""
    echo "✅ All coverage thresholds met!"
  else
    echo ""
    echo "❌ Some coverage thresholds not met. Please add more tests."
    exit 1
  fi
fi

echo ""
echo "📊 Coverage report complete!"







