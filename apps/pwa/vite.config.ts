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
    // PWA Render service (separate from mobile turni-di-palco-fq85.onrender.com)
    allowedHosts: ["turni-di-palco.onrender.com", ".onrender.com"],
  },
  preview: {
    host: true,
    port: 5174,
  },
});
