const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

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
const result = spawnSync(command, commandArgs, { stdio: 'inherit', shell: true, env: process.env });

process.exit(result.status ?? 0);
