#!/usr/bin/env node
const { spawn } = require('node:child_process');
const path = require('node:path');
const dotenv = require('dotenv');

const repoRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(repoRoot, 'apps', 'mobile', '.env') });

const withHttpsPath = path.resolve(__dirname, 'with-https-env.js');
const userArgs = process.argv.slice(2);
const viteArgs =
  userArgs.length > 0
    ? ['vite', ...userArgs]
    : [
        'vite',
        '--host',
        '0.0.0.0',
        '--port',
        '4174',
        '--strictPort',
        '--clearScreen',
        'false',
      ];

const viteProc = spawn('node', [withHttpsPath, ...viteArgs], {
  stdio: 'inherit',
  env: process.env,
});

viteProc.on('error', (err) => {
  console.error(`[dev-mobile] Failed to start Vite: ${err.message}`);
});

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  viteProc.kill('SIGINT');
  process.exit(code);
}

viteProc.on('exit', (code) => {
  shutdown(code ?? 0);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdown(0));
}
