const { createHash } = require('crypto');
const { promises: fs } = require('fs');
const path = require('path');

const PUBLIC_DIR = path.resolve('apps/pwa/public');
const SERVICE_WORKER_PATH = path.join(PUBLIC_DIR, 'sw.js');
const CACHE_VERSION_TOKEN = '__SW_CACHE_VERSION__';

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
  const coreVersionMatch = swContent.match(
    /const CORE_CACHE_VERSION = "([^"]*)";/
  );

  if (!coreVersionMatch && !swContent.includes(CACHE_VERSION_TOKEN)) {
    throw new Error('CORE_CACHE_VERSION token not found in service worker');
  }

  const nextCacheVersion = cacheSuffix;
  const updatedContent = swContent.includes(CACHE_VERSION_TOKEN)
    ? swContent.replaceAll(CACHE_VERSION_TOKEN, nextCacheVersion)
    : swContent.replace(
        /const CORE_CACHE_VERSION = "([^"]*)";/,
        `const CORE_CACHE_VERSION = "${nextCacheVersion}";`
      );

  if (updatedContent === swContent) {
    return nextCacheVersion;
  }

  await fs.writeFile(SERVICE_WORKER_PATH, updatedContent);
  return nextCacheVersion;
}

async function main() {
  const files = await collectFiles(PUBLIC_DIR);
  const hash = await calculateHash(files);
  const cacheVersion = process.env.SW_CACHE_VERSION ?? `v${hash}`;
  const updatedVersion = await updateServiceWorker(cacheVersion);
  console.log(`Updated CORE_CACHE_VERSION to ${updatedVersion}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
