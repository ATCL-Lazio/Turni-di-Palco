import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: ["turni-di-palco.onrender.com", ".onrender.com"], // PWA Render service (mobile uses turni-di-palco-fq85.onrender.com)
  },
  preview: {
    host: true,
    port: 5174,
  },
});
