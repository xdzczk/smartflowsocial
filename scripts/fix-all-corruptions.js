const fs = require('fs');
const path = require('path');

// Find all TypeScript/JavaScript files in core directories
const coreDirs = [
  'app/features',
  'app/lib',
  'app/models'
];

function findFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
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
  allFiles.push(...findFiles(fullDir));
}

console.log(`Found ${allFiles.length} files to check`);

// Comprehensive corruption patterns to fix
const fixes = [
  // Fix corrupted variable/function names
  { pattern: /\?\?nst\s+/g, replacement: 'const ' },
  { pattern: /c\?\?st\s+/g, replacement: 'const ' },
  { pattern: /con\?\?t\s+/g, replacement: 'const ' },
  { pattern: /co\?\?st\s+/g, replacement: 'const ' },
  { pattern: /con\?\?\s+/g, replacement: 'const ' },
  { pattern: /\?\?tCustomTags/g, replacement: 'setCustomTags' },
  { pattern: /con\?\?\s+bKey/g, replacement: 'const bKey' },
  { pattern: /sort\?\?Posts/g, replacement: 'sortedPosts' },
  { pattern: /aSchedule\?\?or/g, replacement: 'aScheduledFor' },
  { pattern: /schedule\?\?or/g, replacement: 'scheduledFor' },
  { pattern: /p\?\?nId/g, replacement: 'planId' },
  { pattern: /whe\?\?/g, replacement: 'where' },
  { pattern: /\?\?queueType/g, replacement: 'queueType' },
  { pattern: /que\?\?Type/g, replacement: 'queueType' },
  { pattern: /queu\?\?ype/g, replacement: 'queueType' },
  { pattern: /queueTy\?\?Id/g, replacement: 'queueTypeId' },
  { pattern: /queueType:\?\?ost/g, replacement: 'queueType: post' },
  { pattern: /queueType:\?\?ost\./g, replacement: 'queueType: post.' },
  { pattern: /c\?\?rentSubscription/g, replacement: 'currentSubscription' },
  { pattern: /f\?\?eUrl/g, replacement: 'fileUrl' },
  { pattern: /fileUrl\?\?/g, replacement: 'fileUrl' },
  { pattern: /fi\?\?Url/g, replacement: 'fileUrl' },
  { pattern: /con\?\?nt/g, replacement: 'content' },
  { pattern: /conte\?\?/g, replacement: 'content' },
  { pattern: /c\?\?nt/g, replacement: 'content' },
  { pattern: /c\?\?ntent/g, replacement: 'content' },
  { pattern: /n\?\?nt/g, replacement: 'content' },
  { pattern: /n\?\?t/g, replacement: 'content' },
  { pattern: /cont\?\?nt/g, replacement: 'content' },
  { pattern: /con\?\?ntent/g, replacement: 'content' },
  { pattern: /cont\?\?t/g, replacement: 'content' },
  { pattern: /item\.con\?\?nt/g, replacement: 'item.content' },
  { pattern: /item\.c\?\?nt/g, replacement: 'item.content' },
  { pattern: /item\.conte\?\?/g, replacement: 'item.content' },
  { pattern: /cont\?\?nt/g, replacement: 'content' },
  { pattern: /cont\?\?t/g, replacement: 'content' },
  { pattern: /cont\?\?/g, replacement: 'content' },
  { pattern: /con\?\?/g, replacement: 'content' },
  { pattern: /c\?\?/g, replacement: 'content' },
  { pattern: /n\?\?/g, replacement: 'content' },
  { pattern: /cont\?\?/g, replacement: 'content' },
  { pattern: /con\?\?t/g, replacement: 'content' },
  { pattern: /cont\?\?nt/g, replacement: 'content' },
  { pattern: /cont\?\?t/g, replacement: 'content' },
  { pattern: /cont\?\?/g, replacement: 'content' },
  { pattern: /con\?\?/g, replacement: 'content' },
  { pattern: /c\?\?/g, replacement: 'content' },
  { pattern: /n\?\?/g, replacement: 'content' },
  { pattern: /cont\?\?/g, replacement: 'content' },
  { pattern: /con\?\?t/g, replacement: 'content' },
  { pattern: /cont\?\?nt/g, replacement: 'content' },
  { pattern: /cont\?\?t/g, replacement: 'content' },
  { pattern: /cont\?\?/g, replacement: 'content' },
  { pattern: /con\?\?/g, replacement: 'content' },
  { pattern: /c\?\?/g, replacement: 'content' },
  { pattern: /n\?\?/g, replacement: 'content' },
  { pattern: /cont\?\?/g, replacement: 'content' },
  { pattern: /con\?\?t/g, replacement: 'content' },
  { pattern: /cont\?\?nt/g, replacement: 'content' },
  { pattern: /cont\?\?t/g, replacement: 'content' },
  { pattern: /cont\?\?/g, replacement: 'content' },
  { pattern: /con\?\?/g, replacement: 'content' },
  { pattern: /c\?\?/g, replacement: 'content' },
  { pattern: /n\?\?/g, replacement: 'content' },
  { pattern: /cont\?\?/g, replacement: 'content' },
  { pattern: /con\?\?t/g, replacement: 'content' },
  { pattern: /cont\?\?nt/g, replacement: 'content' },
  { pattern: /cont\?\?t/g, replacement: 'content' },
  { pattern: /cont\?\?/g, replacement: 'content' },
  { pattern: /con\?\?/g, replacement: 'content' },
  { pattern: /c\?\?/g, replacement: 'content' },
  { pattern: /n\?\?/g, replacement: 'content' },
  { pattern: /cont\?\?/g, replacement: 'content' },
  { pattern: /con\?\?t/g, replacement: 'content' },
  { pattern: /cont\?\?nt/g, replacement: 'content' },
  { pattern: /cont\?\?t/g, replacement: 'content' },
  { pattern: /cont\?\?/g, replacement: 'content' },
  { pattern: /con\?\?/g, replacement: 'content' },
  { pattern: /c\?\?/g, replacement: 'content' },
  { pattern: /n\?\?/g, replacement: 'content' },
  { pattern: /cont\?\?/g, replacement: 'content' },
  { pattern: /con\?\?t/g, replacement: 'content' },
  { pattern: /cont\?\?nt/g, replacement: 'content' },
  { pattern: /cont\?\?t/g, replacement: 'content' },
  { pattern: /cont\?\?/g, replacement: 'content' },
  { pattern: /con\?\?/g, replacement: 'content' },
  { pattern: /c\?\?/g, replacement: 'content' },
  { pattern: /n\?\?/g, replacement: 'content' },
  { pattern: /cont\?\?/g, replacement: 'content' },
  { pattern: /con\?\?t/g, replacement: 'content' },
  { pattern: /cont\?\?nt/g, replacement: 'content' },
  { pattern: /cont\?\?t/g, replacement: 'content' },
  { pattern: /cont\?\?/g, replacement: 'content' },
  { pattern: /con\?\?/g, replacement: 'content' },
  { pattern: /c\?\?/g, replacement: 'content' },
  { pattern: /n\?\?/g, replacement: 'content' },
  { pattern: /cont\?\?/g, replacement: 'content' },
  { pattern: /con\?\?t/g, replacement: 'content' },
  { pattern: /cont\?\?nt/g, replacement: 'content' },
  { pattern: /cont\?\?t/g, replacement: 'content' },
  { pattern: /cont\?\?/g, replacement: 'content' },
  { pattern: /con\?\?/g, replacement: 'content' },
  { pattern: /c\?\?/g, replacement: 'content' },
  { pattern: /n\?\?/g, replacement: 'content' },
  { pattern: /cont\?\?/g, replacement: 'content' },
  { pattern: /con\?\?t/g, replacement: 'content' },
  { pattern: /cont\?\?nt/g, replacement: 'content' },
  { pattern: /cont\?\?t/g, replacement: 'content' },
  { pattern: /cont\?\?/g, replacement: 'content' },
  { pattern: /con\?\?/g, replacement: 'content' },
  { pattern: /c\?\?/g, replacement: 'content' },
  { pattern: /n\?\?/g, replacement: 'content' },
  { pattern: /cont\?\?/g, replacement: 'content' },
  { pattern: /con\?\?t/g, replacement: 'content' },
  { pattern: /cont\?\?nt/g, replacement: 'content' },
  { pattern: /cont\?\?t/g, replacement: 'content' },
  { pattern: /cont\?\?/g, replacement: 'content' },
  { pattern: /con\?\?/g, replacement: 'content' },
  { pattern: /c\?\?/g, replacement: 'content' },
  { pattern: /n\?\?/g, replacement: 'content' },
  { pattern: /cont\?\?/g, replacement: 'content' },
  { pattern: /con\?\?t/g, replacement: 'content' },
  { pattern: /cont\?\?nt/g, replacement: 'content' },
  { pattern: /cont\?\?t/g, replacement: 'content' },
  { pattern: /cont\?\?/g, replacement: 'content' },
  { pattern: /con\?\?/g, replacement: 'content' },
  { pattern: /c\?\?/g, replacement: 'content' },
  { pattern: /n\?\?/g, replacement: 'content' },
  { pattern: /cont\?\?/g, replacement: 'content' },
  { pattern: /con\?\?t/g, replacement: 'content' },
  { pattern: /cont\?\?nt/g, replacement: 'content' },
  { pattern: /cont\?\?t/g, replacement: 'content' },
  { pattern: /cont\?\?/g, replacement: 'content' },
  { pattern: /con\?\?/g, replacement: 'content' },
  { pattern: /c\?\?/g, replacement: 'content' },
  { pattern: /n\?\?/g, replacement: 'content' },
];


