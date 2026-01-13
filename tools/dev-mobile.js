#!/usr/bin/env node
const { spawn } = require('node:child_process');
const path = require('node:path');

const withHttpsPath = path.resolve(__dirname, 'with-https-env.js');
const aiSupportPath = path.resolve(__dirname, 'ai-support-server.js');
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

const aiProc = spawn('node', [aiSupportPath], {
  stdio: 'inherit',
  env: process.env,
});

const viteProc = spawn('node', [withHttpsPath, ...viteArgs], {
  stdio: 'inherit',
  env: process.env,
});

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  aiProc.kill('SIGINT');
  viteProc.kill('SIGINT');
  process.exit(code);
}

aiProc.on('exit', (code) => {
  if (!shuttingDown && code && code !== 0) {
    process.stderr.write('AI support server stopped unexpectedly.\n');
    shutdown(code);
  }
});

viteProc.on('exit', (code) => {
  shutdown(code ?? 0);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdown(0));
}
