# Turni di Palco – PWA base

Starter Progressive Web App shell for Turni di Palco with Vite and TypeScript. It includes an installable manifest, a custom service worker for offline support, and a lightweight landing UI to wire future gameplay into.

## Quick start
- Install dependencies: `npm install`
- Run locally: `npm run dev` (defaults to `http://localhost:5173`, network-hosted for device testing)
- Run locally with HTTPS (auto self-signed cert): `npm run dev:https -- --port 5173` then open the “Network” URL shown by Vite; accept the cert warning. Use `--host 0.0.0.0` if you want LAN access.
- Build: `npm run build` → outputs to `dist/`
- Preview built app: `npm run preview`
- Preview with HTTPS: `npm run preview:https -- --port 4173`
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
