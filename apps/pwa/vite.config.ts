import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    {
      // La CSP via <meta> è pensata per i build: in dev Vite inietta script inline
      // (React refresh) e usa ws://, che una CSP rigorosa bloccherebbe.
      name: 'strip-csp-meta-in-dev',
      apply: 'serve',
      transformIndexHtml: (html: string) =>
        html.replace(/\s*<meta\s+http-equiv="Content-Security-Policy"[^>]*>/i, ''),
    },
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: ["turni-di-palco.onrender.com", "turni-di-palco-fq85.onrender.com"],
  },
  preview: {
    host: true,
    port: 5174,
  },
});
