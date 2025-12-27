const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find all TypeScript/JavaScript files in core directories
const coreDirs = [
  'app/features',
  'app/lib',
  'app/models'
];

function findFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findFiles(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      files.push(fullPath);
    }
  }
  return files;
}

const allFiles = [];
for (const dir of coreDirs) {
  const fullDir = path.join(__dirname, '..', dir);
  if (fs.existsSync(fullDir)) {
    allFiles.push(...findFiles(fullDir));
  }
}

console.log(`Found ${allFiles.length} files to check`);

// Common corruption patterns to fix
const fixes = [
  // Fix corrupted variable names
  { pattern: /\?\?nst\s+/g, replacement: 'const ' },
  { pattern: /c\?\?st\s+/g, replacement: 'const ' },
  // Fix corrupted property names
  { pattern: /\?\?plies/g, replacement: 'replies' },
  { pattern: /\?\?entions/g, replacement: 'mentions' },
  { pattern: /\?\?posts/g, replacement: 'reposts' },
  { pattern: /zap\?\?/g, replacement: 'zaps' },
  { pattern: /conte\?\?/g, replacement: 'content' },
  { pattern: /scheduledF\?\?/g, replacement: 'scheduledFor' },
  { pattern: /po\?\?edAt/g, replacement: 'postedAt' },
  { pattern: /queu\?\?ype/g, replacement: 'queueType' },
  { pattern: /capt\?\?n/g, replacement: 'caption' },
  { pattern: /exte\?\?ion/g, replacement: 'extension' },
  // Fix corrupted keywords
  { pattern: /\}\s+\?\?tch\s+/g, replacement: '} catch ' },
  // Fix corrupted operators
  { pattern: /\?\?\|\|/g, replacement: '??' }, // This might need context, but ?? || should be ??
  // Fix specific corrupted expressions
  { pattern: /me\(metadata\.name\s+\?\?\s+metadata\.display_name\)\s+\?\?authorImage/g, replacement: 'metadata.name ?? metadata.display_name; authorImage' },
  { pattern: /queueType:\?\?ost\./g, replacement: 'queueType: post.' },
  { pattern: /c\.displayName\)a\?\?\s+\|\|/g, replacement: 'c.displayName) ??' },
];

let fixedCount = 0;
for (const file of allFiles) {
  try {
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;
    const originalContent = content;
    
    for (const fix of fixes) {
      if (fix.pattern.test(content)) {
        content = content.replace(fix.pattern, fix.replacement);
        modified = true;
      }
    }
    
    if (modified) {
      fs.writeFileSync(file, content, 'utf8');
      fixedCount++;
      console.log(`Fixed: ${file}`);
    }
  } catch (err) {
    console.error(`Error processing ${file}:`, err.message);
  }
}

console.log(`\nFixed ${fixedCount} files`);

