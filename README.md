# Turni di Palco – Monorepo

Monorepo per PWA, mobile UI e CMS. La PWA è sviluppata con Vite/TypeScript ed è ora sotto `apps/pwa`. La mobile UI resta nel submodule `UI`.

## Quick start (PWA)
- Installa dipendenze: `npm install` (root, usa workspaces per la PWA; genera lockfile unico).
- Avvia dev (HTTP): `npm run dev:pwa` (http://localhost:5173).
- Avvia dev (HTTPS): `npm run dev:pwa:https` con variabili `SSL_CRT_FILE`/`SSL_KEY_FILE` (vedi `run.ps1`/`run.bat`).
- Build: `npm run build:pwa` → output in `apps/pwa/dist`.
- Preview: `npm run preview:pwa`.
- Test: `npm run test:pwa` (Vitest placeholder).
- Mobile bundle: `npm run build:mobile` (build + copia in `apps/pwa/public/mobile/`); solo copia: `npm run sync:mobile`.

## Struttura
- `apps/pwa`: PWA Vite multipage. HTML in root package, sorgenti in `src/`, asset in `public/` (include `public/mobile/` con bundle mobile e `public/sw.js`).
- `UI`: submodule mobile UI (build Vite/React) – fonte degli asset copiati in `apps/pwa/public/mobile/` via script.
- `reactbricks`: sorgente CMS (da pulire, non ancora workspace).
- `docs and references/`: PDF di design/GDD.

## PWA notes
- Service worker: `apps/pwa/public/sw.js` pre-cacha shell/offline. `npm run build:pwa` esegue `node tools/update-cache-version.js` per calcolare l'hash degli asset core (`apps/pwa/public/**`, escluso `sw.js`) e aggiornare `CACHE_NAME` (rinomina in base all'hash). Puoi lanciare lo script manualmente quando modifichi asset statici per forzare l'update della cache.
- Manifest: `apps/pwa/public/manifest.webmanifest`.
- Icone: `apps/pwa/public/icons/pwa-192.png`, `pwa-512.png` (placeholder).
- Design tokens: `apps/pwa/src/styles/tokens.css` centralizza palette, scala tipografica e spaziature (include gradient brand e superfici chip/pill). Importa il file prima di `style.css` negli entry Vite.
- Temi: le pagine espongono `data-theme` sul `<body>` (default `dark`, alternativa `light`) e i componenti leggono le CSS custom properties; sincronizza il meta `theme-color` con il colore di base del tema attivo.

## Prossimi passi
- Allineare il workflow CI/CD ai workspaces (build PWA + copia mobile dal submodule).
- Aggiungere lint/format e test reali.
- Ripulire/integrare `reactbricks` come workspace separato.
