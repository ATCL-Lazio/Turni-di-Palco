
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

  return flag ? ({} as ServerOptions) : ({} as ServerOptions);
}

const DEFAULT_ALLOWED_HOSTS = ['turni-di-palco-fq85.onrender.com'];
const DEFAULT_AI_SUPPORT_PORT = Number.parseInt(String.fromCharCode(56, 55, 56, 55), 10);

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
        'vaul@1.1.2': 'vaul',
        'sonner@2.0.3': 'sonner',
        'recharts@2.15.2': 'recharts',
        'react-resizable-panels@2.1.7': 'react-resizable-panels',
        'react-hook-form@7.55.0': 'react-hook-form',
        'react-day-picker@8.10.1': 'react-day-picker',
        'next-themes@0.4.6': 'next-themes',
        'lucide-react@0.487.0': 'lucide-react',
        'input-otp@1.4.2': 'input-otp',
        'embla-carousel-react@8.6.0': 'embla-carousel-react',
        'cmdk@1.1.1': 'cmdk',
        'class-variance-authority@0.7.1': 'class-variance-authority',
        '@radix-ui/react-tooltip@1.1.8': '@radix-ui/react-tooltip',
        '@radix-ui/react-toggle@1.1.2': '@radix-ui/react-toggle',
        '@radix-ui/react-toggle-group@1.1.2': '@radix-ui/react-toggle-group',
        '@radix-ui/react-tabs@1.1.3': '@radix-ui/react-tabs',
        '@radix-ui/react-switch@1.1.3': '@radix-ui/react-switch',
        '@radix-ui/react-slot@1.1.2': '@radix-ui/react-slot',
        '@radix-ui/react-slider@1.2.3': '@radix-ui/react-slider',
        '@radix-ui/react-separator@1.1.2': '@radix-ui/react-separator',
        '@radix-ui/react-select@2.1.6': '@radix-ui/react-select',
        '@radix-ui/react-scroll-area@1.2.3': '@radix-ui/react-scroll-area',
        '@radix-ui/react-radio-group@1.2.3': '@radix-ui/react-radio-group',
        '@radix-ui/react-progress@1.1.2': '@radix-ui/react-progress',
        '@radix-ui/react-popover@1.1.6': '@radix-ui/react-popover',
        '@radix-ui/react-navigation-menu@1.2.5': '@radix-ui/react-navigation-menu',
        '@radix-ui/react-menubar@1.1.6': '@radix-ui/react-menubar',
        '@radix-ui/react-label@2.1.2': '@radix-ui/react-label',
        '@radix-ui/react-hover-card@1.1.6': '@radix-ui/react-hover-card',
        '@radix-ui/react-dropdown-menu@2.1.6': '@radix-ui/react-dropdown-menu',
        '@radix-ui/react-dialog@1.1.6': '@radix-ui/react-dialog',
        '@radix-ui/react-context-menu@2.2.6': '@radix-ui/react-context-menu',
        '@radix-ui/react-collapsible@1.1.3': '@radix-ui/react-collapsible',
        '@radix-ui/react-checkbox@1.1.4': '@radix-ui/react-checkbox',
        '@radix-ui/react-avatar@1.1.3': '@radix-ui/react-avatar',
        '@radix-ui/react-aspect-ratio@1.1.2': '@radix-ui/react-aspect-ratio',
        '@radix-ui/react-alert-dialog@1.1.6': '@radix-ui/react-alert-dialog',
        '@radix-ui/react-accordion@1.2.3': '@radix-ui/react-accordion',
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      target: 'esnext',
      outDir: 'build',
    },
    server: {
      host: true,
      port: 3000,
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
