import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    outDir: "dist",
    emptyOutDir: false,
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: ["turni-di-palco.onrender.com", ".onrender.com"],
  },
  preview: {
    host: true,
    port: 5174,
  },
});
