# Turni di Palco – PWA base

Starter Progressive Web App shell for Turni di Palco with Vite and TypeScript. It includes an installable manifest, a custom service worker for offline support, and a lightweight landing UI to wire future gameplay into.

## Quick start
- Install dependencies: `npm install`
- Run locally (HTTP): `npm run dev` (defaults to `http://localhost:5173`, network-hosted for device testing)
- Run locally with HTTPS:
  - Genera un certificato fidato con `mkcert` (consigliato, così funziona anche su iOS):  
    ```
    mkcert dev.localhost
    ```
    Esporta le variabili (PowerShell):  
    ```
    $env:SSL_CRT_FILE=\"$(Resolve-Path ./dev.localhost.pem)\"
    $env:SSL_KEY_FILE=\"$(Resolve-Path ./dev.localhost-key.pem)\"
    npm run dev:https -- --port 5173
    ```
    Usa l’URL “Network” stampato da Vite (es. `https://dev.localhost:5173`) e installa/accetta il certificato anche sul device.
  - In alternativa, per test rapidi e warning: `npm run dev:https -- --port 5173` (self-signed non fidato).
- Build: `npm run build` → outputs to `dist/`
- Preview built app (HTTP): `npm run preview`
- Preview with HTTPS: `npm run preview:https -- --port 4173` (rispetta `SSL_CRT_FILE`/`SSL_KEY_FILE` se presenti)
- Tests: `npm test` (Vitest, currently placeholder setup)

## Structure
- `index.html`: App shell entry with manifest links and theme color.
- `src/`: TypeScript source (`main.ts` bootstraps UI, `pwa/register-sw.ts` handles service worker lifecycle, `style.css` defines the base look). Add gameplay modules here.
- `public/`: Static assets copied as-is (`manifest.webmanifest`, `sw.js`, PWA icons in `public/icons/`).
- `docs and references/`: Existing design and GDD PDFs (kept untouched).

## PWA notes
- Service worker (`public/sw.js`) pre-caches the shell and caches fetched assets on first use; updates trigger a “Reload for updates” CTA.
- Manifest (`public/manifest.webmanifest`) sets name, colors, start URL, and icons for install prompts.
- Icons (`public/icons/pwa-192.png`, `pwa-512.png`) are placeholders—replace with final branding when available.

## Next steps
- Add gameplay UI modules under `src/` and route to them from `main.ts`.
- Expand tests in `src/test/` for core logic and offline behaviour.
- Consider adding lint/format tooling (ESLint/Prettier) and CI scripts once the codebase grows.
