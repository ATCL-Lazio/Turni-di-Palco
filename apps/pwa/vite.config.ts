import fs from "fs";
import path from "path";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

function resolveHttps() {
  const httpsEnv = process.env.HTTPS;
  if (httpsEnv === "false" || httpsEnv === "0") {
    return false;
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

  return flag || true;
}

const httpsOption = resolveHttps();

export default defineConfig({
  appType: "mpa",
  plugins: [tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        dev: path.resolve(__dirname, "dev.html"),
        game: path.resolve(__dirname, "game.html"),
        map: path.resolve(__dirname, "map.html"),
        avatar: path.resolve(__dirname, "avatar.html"),
        profile: path.resolve(__dirname, "profile.html"),
        events: path.resolve(__dirname, "events.html"),
        turns: path.resolve(__dirname, "turns.html"),
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    https: httpsOption,
    allowedHosts: true,
  },
  preview: {
    host: true,
    port: 4173,
    https: httpsOption,
    allowedHosts: true,
  },
});
