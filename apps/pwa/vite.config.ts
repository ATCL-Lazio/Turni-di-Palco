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
    mobileOps: path.resolve(__dirname, "mobile-ops.html"),
    mobileInfrastructure: path.resolve(__dirname, "mobile-infrastructure.html"),
    mobileAccess: path.resolve(__dirname, "mobile-access.html"),
    mobileRuntime: path.resolve(__dirname, "mobile-runtime.html"),
    privacy: path.resolve(__dirname, "privacy.html"),
    mobileReleases: path.resolve(__dirname, "mobile-releases.html"),
    mobileDataOps: path.resolve(__dirname, "mobile-data-ops.html"),
    mobileAudit: path.resolve(__dirname, "mobile-audit.html"),
    gameLegacy: path.resolve(__dirname, "game.html"),
    mapLegacy: path.resolve(__dirname, "map.html"),
    avatarLegacy: path.resolve(__dirname, "avatar.html"),
    profileLegacy: path.resolve(__dirname, "profile.html"),
    eventsLegacy: path.resolve(__dirname, "events.html"),
    turnsLegacy: path.resolve(__dirname, "turns.html"),
    leaderboardLegacy: path.resolve(__dirname, "leaderboard.html"),
  };

  if (!isPublicMode) {
    buildInputs.devPlayground = path.resolve(__dirname, "dev-playground.html");
    buildInputs.controlPlane = path.resolve(__dirname, "control-plane.html");
    buildInputs.devLegacy = path.resolve(__dirname, "dev.html");
    buildInputs.devPlusLegacy = path.resolve(__dirname, "dev-plus.html");
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
