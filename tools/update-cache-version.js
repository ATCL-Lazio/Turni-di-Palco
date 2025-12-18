const { createHash } = require('crypto');
const { promises: fs } = require('fs');
const path = require('path');

const PUBLIC_DIR = path.resolve('apps/pwa/public');
const SERVICE_WORKER_PATH = path.join(PUBLIC_DIR, 'sw.js');
const CACHE_PREFIX = 'turni-di-palco-v';

async function collectFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name);
      if (entryPath === SERVICE_WORKER_PATH) return [];
      if (entry.isDirectory()) {
        return collectFiles(entryPath);
      }
      return [entryPath];
    })
  );
  return files.flat();
}

async function calculateHash(filePaths) {
  const hash = createHash('sha256');
  for (const filePath of filePaths.sort()) {
    const content = await fs.readFile(filePath);
    const relativePath = path.relative(PUBLIC_DIR, filePath);
    hash.update(relativePath);
    hash.update('\0');
    hash.update(content);
  }
  return hash.digest('hex').slice(0, 8);
}

async function updateServiceWorker(cacheSuffix) {
  const swContent = await fs.readFile(SERVICE_WORKER_PATH, 'utf8');
  const match = swContent.match(/const CACHE_NAME = "([^"]*)";/);
  if (!match) {
    throw new Error('CACHE_NAME pattern not found in service worker');
  }

  const nextCacheName = `${CACHE_PREFIX}${cacheSuffix}`;
  if (match[1] === nextCacheName) {
    return nextCacheName;
  }

  const updatedContent = swContent.replace(match[0], `const CACHE_NAME = "${nextCacheName}";`);
  await fs.writeFile(SERVICE_WORKER_PATH, updatedContent);
  return nextCacheName;
}

async function main() {
  const files = await collectFiles(PUBLIC_DIR);
  const hash = await calculateHash(files);
  const cacheName = await updateServiceWorker(hash);
  console.log(`Updated CACHE_NAME to ${cacheName}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
