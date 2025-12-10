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
  appType: "spa",
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
