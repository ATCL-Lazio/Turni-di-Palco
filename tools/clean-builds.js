const fs = require('fs');
const path = require('path');

const buildDirs = [
  path.resolve('dist'),
  path.resolve('apps/pwa/dist'),
  path.resolve('apps/mobile/dist'),
];

function cleanDir(dirPath) {
  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
    return true;
  } catch (error) {
    console.warn(`Unable to clean ${dirPath}: ${error.message}`);
    return false;
  }
}

const cleaned = buildDirs.filter(cleanDir);
console.log(`Cleaned build outputs: ${cleaned.join(', ')}`);
