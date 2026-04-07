#!/usr/bin/env node
/**
 * sync-mobile.js
 * Copies apps/mobile/build/ → apps/pwa/public/mobile/
 * Uses SHA-256 checksums to skip unchanged files.
 */

'use strict';

const { createHash } = require('node:crypto');
const {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} = require('node:fs');
const { join, relative } = require('node:path');

const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'apps/mobile/build');
const DEST = join(ROOT, 'apps/pwa/public/mobile');
const CHECKSUM_FILE = join(DEST, '.mobile-checksum');

if (!existsSync(SRC)) {
  console.error(`[sync-mobile] Source not found: ${SRC}`);
  console.error('[sync-mobile] Run the mobile build first.');
  process.exit(1);
}

/** Compute a SHA-256 digest of all files under a directory. */
function dirChecksum(dir) {
  const hash = createHash('sha256');
  function walk(current) {
    const entries = readdirSync(current, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        hash.update(relative(dir, full));
        hash.update(readFileSync(full));
      }
    }
  }
  walk(dir);
  return hash.digest('hex');
}

const newChecksum = dirChecksum(SRC);
const prevChecksum = existsSync(CHECKSUM_FILE)
  ? readFileSync(CHECKSUM_FILE, 'utf-8').trim()
  : '';

if (newChecksum === prevChecksum) {
  console.log('[sync-mobile] No changes detected, skipping copy.');
  process.exit(0);
}

console.log('[sync-mobile] Syncing apps/mobile/build/ → apps/pwa/public/mobile/');
mkdirSync(DEST, { recursive: true });
cpSync(SRC, DEST, { recursive: true, force: true });
writeFileSync(CHECKSUM_FILE, newChecksum + '\n', 'utf-8');
console.log('[sync-mobile] Done.');
