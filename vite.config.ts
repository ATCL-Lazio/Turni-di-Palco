import fs from "fs";
import path from "path";
import { defineConfig } from "vite";

function resolveHttps() {
  const flag = process.env.HTTPS === "true" || process.env.HTTPS === "1";
  const certPath = process.env.SSL_CRT_FILE;
  const keyPath = process.env.SSL_KEY_FILE;

  if (certPath && keyPath && fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    return {
      cert: fs.readFileSync(path.resolve(certPath)),
      key: fs.readFileSync(path.resolve(keyPath)),
    };
  }

  return flag;
}

const httpsOption = resolveHttps();

export default defineConfig({
  appType: "mpa",
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
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
  },
  preview: {
    host: true,
    port: 4173,
    https: httpsOption,
  },
});
