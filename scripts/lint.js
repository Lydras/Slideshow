const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.cwd();
const TARGETS = ['server.js', 'src', 'public/js', 'tests', 'scripts'];
const IGNORED_DIRS = new Set(['node_modules', 'data', '.git', '.agent', '.agents', '.auto-claude', '.claude', '.cursor']);

function collectJsFiles(targetPath, files) {
  if (!fs.existsSync(targetPath)) return;
  const stat = fs.statSync(targetPath);

  if (stat.isFile()) {
    if (targetPath.endsWith('.js')) files.push(targetPath);
    return;
  }

  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;
    collectJsFiles(path.join(targetPath, entry.name), files);
  }
}

function main() {
  const files = [];
  for (const target of TARGETS) {
    collectJsFiles(path.join(ROOT, target), files);
  }

  const uniqueFiles = Array.from(new Set(files)).sort();
  if (uniqueFiles.length === 0) {
    console.log('No JavaScript files found to lint.');
    return;
  }

  for (const file of uniqueFiles) {
    execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  }

  console.log(`Syntax check passed for ${uniqueFiles.length} files.`);
}

main();
