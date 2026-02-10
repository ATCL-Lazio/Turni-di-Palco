import fs from "fs";
import path from "path";
import type { ServerOptions as HttpsServerOptions } from "https";
import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";

function resolveHttps(): HttpsServerOptions | undefined {
  const httpsEnv = process.env.HTTPS;
  if (httpsEnv === "false" || httpsEnv === "0") {
    return undefined;
  }

  const flag = httpsEnv === "true" || httpsEnv === "1";
  const certPath = process.env.SSL_CRT_FILE;
  const keyPath = process.env.SSL_KEY_FILE;

  if (certPath && keyPath && fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    return {
      cert: fs.readFileSync(path.resolve(certPath)),
      key: fs.readFileSync(path.resolve(keyPath)),
    };
  }

  const repoRoot = path.resolve(__dirname, "..", "..");
  const certRoot = path.join(repoRoot, ".cert");
  if (fs.existsSync(certRoot)) {
    const keyFile = fs.readdirSync(certRoot).find((name) => name.endsWith("-key.pem"));
    if (keyFile) {
      const keyBase = path.basename(keyFile, ".pem").replace(/-key$/, "");
      const certFile = path.join(certRoot, `${keyBase}.pem`);
      const keyFilePath = path.join(certRoot, keyFile);
      if (fs.existsSync(certFile)) {
        return {
          cert: fs.readFileSync(certFile),
          key: fs.readFileSync(keyFilePath),
        };
      }
    }
  }

  if (flag) return {};
  return {};
}

const DEFAULT_ALLOWED_HOSTS = ["turni-di-palco-fq85.onrender.com"];

function resolveAllowedHosts(env: Record<string, string>) {
  const raw =
    env.VITE_ALLOWED_HOSTS ||
    env.ALLOWED_HOSTS ||
    process.env.VITE_ALLOWED_HOSTS ||
    process.env.ALLOWED_HOSTS;
  if (!raw) return DEFAULT_ALLOWED_HOSTS;
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const httpsOption = resolveHttps();
  const publicModeValue = env.VITE_PUBLIC_MODE || process.env.VITE_PUBLIC_MODE;
  const isPublicMode = publicModeValue === "true" || publicModeValue === "1";
  const allowedHosts = resolveAllowedHosts(env);

  const buildInputs: Record<string, string> = {
    main: path.resolve(__dirname, "index.html"),
    game: path.resolve(__dirname, "game.html"),
    map: path.resolve(__dirname, "map.html"),
    avatar: path.resolve(__dirname, "avatar.html"),
    profile: path.resolve(__dirname, "profile.html"),
    privacy: path.resolve(__dirname, "privacy.html"),
    events: path.resolve(__dirname, "events.html"),
    turns: path.resolve(__dirname, "turns.html"),
    leaderboard: path.resolve(__dirname, "leaderboard.html"),
  };

  if (!isPublicMode) {
    buildInputs.dev = path.resolve(__dirname, "dev.html");
    buildInputs.devPlus = path.resolve(__dirname, "dev-plus.html");
  }

  return {
    appType: "mpa",
    plugins: [tailwindcss()],
    build: {
      rollupOptions: {
        input: buildInputs,
      },
    },
    server: {
      host: true,
      port: 5173,
      https: httpsOption,
      allowedHosts,
    },
    preview: {
      host: true,
      port: 4173,
      https: httpsOption,
      allowedHosts,
    },
  };
});
