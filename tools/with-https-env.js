const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const qrcode = require('qrcode-terminal');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node tools/with-https-env.js <command> [args...]');
  process.exit(1);
}

const httpsEnv = process.env.HTTPS;
const httpsDisabled = httpsEnv === 'false' || httpsEnv === '0';
if (!httpsDisabled && !httpsEnv) {
  process.env.HTTPS = 'true';
}

if (!httpsDisabled && (!process.env.SSL_CRT_FILE || !process.env.SSL_KEY_FILE)) {
  const repoRoot = path.resolve(__dirname, '..');
  const certRoot = path.join(repoRoot, '.cert');

  if (fs.existsSync(certRoot)) {
    const keyFile = fs.readdirSync(certRoot).find((name) => name.endsWith('-key.pem'));
    if (keyFile) {
      const keyBase = path.basename(keyFile, '.pem').replace(/-key$/, '');
      const certFile = path.join(certRoot, `${keyBase}.pem`);
      const keyFilePath = path.join(certRoot, keyFile);

      if (fs.existsSync(certFile)) {
        process.env.SSL_KEY_FILE = keyFilePath;
        process.env.SSL_CRT_FILE = certFile;
      }
    }
  }
}

const command = args[0];
const commandArgs = args.slice(1);

const qrEnv = process.env.QR;
const enableQr =
  qrEnv !== '0' &&
  qrEnv !== 'false' &&
  qrEnv !== 'no' &&
  process.env.NO_QR !== '1';

const seenQrUrls = new Set();

function stripAnsi(value) {
  return value.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
}

function maybePrintQrForLine(line) {
  if (!enableQr) return;
  const clean = stripAnsi(line).trimEnd();
  const match = clean.match(/\b(?:Local|Network):\s+(https?:\/\/\S+)/);
  if (!match) return;

  const url = match[1];
  if (seenQrUrls.has(url)) return;
  seenQrUrls.add(url);

  process.stdout.write(`\nQR: ${url}\n`);
  qrcode.generate(url, { small: true });
  process.stdout.write('\n');
}

function forwardAndParse(stream, writeTo) {
  let buffer = '';
  stream.on('data', (chunk) => {
    const text = chunk.toString('utf8');
    writeTo.write(text);

    buffer += text;
    const parts = buffer.split(/\r?\n/);
    buffer = parts.pop() ?? '';
    for (const line of parts) maybePrintQrForLine(line);
  });

  stream.on('end', () => {
    if (buffer) maybePrintQrForLine(buffer);
  });
}

const child = spawn(command, commandArgs, {
  shell: true,
  env: process.env,
  stdio: ['inherit', 'pipe', 'pipe'],
});

forwardAndParse(child.stdout, process.stdout);
forwardAndParse(child.stderr, process.stderr);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.on('exit', (code) => process.exit(code ?? 0));
