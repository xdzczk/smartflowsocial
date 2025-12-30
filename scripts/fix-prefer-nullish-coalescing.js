const fs = require('fs');
const path = require('path');

// Read ESLint report
const reportPath = path.join(__dirname, '..', 'eslint-report.json');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

// Filter files in core directories with prefer-nullish-coalescing errors
const coreFiles = report
  .filter(file => {
    const hasError = file.messages.some(m => m.ruleId === '@typescript-eslint/prefer-nullish-coalescing');
    const inCoreDir = file.filePath.includes('app/features/') || 
                     file.filePath.includes('app/lib/') || 
                     file.filePath.includes('app/models/');
    return hasError && inCoreDir;
  })
  .map(file => ({
    path: file.filePath,
    errors: file.messages
      .filter(m => m.ruleId === '@typescript-eslint/prefer-nullish-coalescing')
      .map(m => ({
        line: m.line,
        column: m.column,
        suggestion: m.suggestions?.[0]?.fix
      }))
      .filter(m => m.suggestion) // Only include errors with suggestions
  }))
  .filter(file => file.errors.length > 0);

console.log(`Found ${coreFiles.length} files to fix`);
console.log(`Total errors: ${coreFiles.reduce((sum, f) => sum + f.errors.length, 0)}`);

// Process each file
let fixedCount = 0;
for (const file of coreFiles) {
  try {
    let content = fs.readFileSync(file.path, 'utf8');
    let modified = false;
    
    // Apply fixes in reverse order (from end to start) to avoid offset issues
    const sortedErrors = [...file.errors].sort((a, b) => {
      // Sort by suggestion range end (descending)
      const aEnd = a.suggestion.range[1];
      const bEnd = b.suggestion.range[1];
      return bEnd - aEnd;
    });
    
    for (const error of sortedErrors) {
      const [start, end] = error.suggestion.range;
      const oldText = content.substring(start, end);
      const newText = error.suggestion.text;
      
      if (oldText !== newText) {
        content = content.substring(0, start) + newText + content.substring(end);
        modified = true;
      }
    }
    
    if (modified) {
      fs.writeFileSync(file.path, content, 'utf8');
      fixedCount++;
      console.log(`Fixed ${file.errors.length} errors in ${file.path}`);
    }
  } catch (err) {
    console.error(`Error processing ${file.path}:`, err.message);
  }
}

console.log(`\nFixed ${fixedCount} files`);


