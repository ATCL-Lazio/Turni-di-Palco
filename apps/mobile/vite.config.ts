
import fs from 'fs';
import type { ServerOptions } from 'https';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

function resolveHttps(): ServerOptions | undefined {
  const httpsEnv = process.env.HTTPS;
  if (httpsEnv === 'false' || httpsEnv === '0') {
    return undefined;
  }

  const flag = httpsEnv === 'true' || httpsEnv === '1';
  const certPath = process.env.SSL_CRT_FILE;
  const keyPath = process.env.SSL_KEY_FILE;

  if (certPath && keyPath && fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    return {
      cert: fs.readFileSync(path.resolve(certPath)),
      key: fs.readFileSync(path.resolve(keyPath)),
    } as ServerOptions;
  }

  const repoRoot = path.resolve(__dirname, '..', '..');
  const certRoot = path.join(repoRoot, '.cert');
  if (fs.existsSync(certRoot)) {
    const keyFile = fs.readdirSync(certRoot).find((name) => name.endsWith('-key.pem'));
    if (keyFile) {
      const keyBase = path.basename(keyFile, '.pem').replace(/-key$/, '');
      const certFile = path.join(certRoot, `${keyBase}.pem`);
      const keyFilePath = path.join(certRoot, keyFile);
      if (fs.existsSync(certFile)) {
        return {
          cert: fs.readFileSync(certFile),
          key: fs.readFileSync(keyFilePath),
        } as ServerOptions;
      }
    }
  }

  return flag ? ({} as ServerOptions) : undefined;
}

const DEFAULT_ALLOWED_HOSTS = ['turni-di-palco-fq85.onrender.com'];
const DEFAULT_AI_SUPPORT_PORT = 8787;

function resolveAllowedHosts(env: Record<string, string>) {
  const raw =
    env.VITE_ALLOWED_HOSTS ||
    env.ALLOWED_HOSTS ||
    process.env.VITE_ALLOWED_HOSTS ||
    process.env.ALLOWED_HOSTS;
  if (!raw) return DEFAULT_ALLOWED_HOSTS;
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const httpsOption = resolveHttps();
  const allowedHosts = resolveAllowedHosts(env);
  const aiSupportPort = Number(
    env.AI_SUPPORT_PORT || env.VITE_AI_SUPPORT_PORT || process.env.AI_SUPPORT_PORT
  ) || DEFAULT_AI_SUPPORT_PORT;

  return {
    base: '/mobile/',
    plugins: [react(), tailwindcss()],
    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      target: 'esnext',
      outDir: 'build',
    },
    server: {
      host: true,
      port: 4174,
      https: httpsOption,
      allowedHosts,
      open: true,
      proxy: {
        '/api/ai/chat': {
          target: `http://localhost:${aiSupportPort}`,
          changeOrigin: true,
        },
        '/health': {
          target: `http://localhost:${aiSupportPort}`,
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: true,
      port: 4174,
      https: httpsOption,
      allowedHosts,
    },
  };
});
