import { defineConfig } from "vite";

export default defineConfig({
  appType: "spa",
  server: {
    host: true,
    port: 5173,
    https: process.env.HTTPS === "true" || process.env.HTTPS === "1",
  },
  preview: {
    host: true,
    port: 4173,
    https: process.env.HTTPS === "true" || process.env.HTTPS === "1",
  },
});
