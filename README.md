# Turni di Palco - Monorepo
[![Netlify Status](https://api.netlify.com/api/v1/badges/82f90be3-aaed-4dcc-8a21-8ee00395d6eb/deploy-status)](https://app.netlify.com/projects/turni-di-palco/deploys)
[![Mobile Build](https://github.com/Heartran/Turni-di-Palco/actions/workflows/mobile-build.yml/badge.svg)](https://github.com/Heartran/Turni-di-Palco/actions/workflows/mobile-build.yml)
[![Cleanup Old Events](https://github.com/Heartran/Turni-di-Palco/actions/workflows/cleanup-events.yml/badge.svg)](https://github.com/Heartran/Turni-di-Palco/actions/workflows/cleanup-events.yml)
[![CI](https://github.com/Heartran/Turni-di-Palco/actions/workflows/ci.yml/badge.svg)](https://github.com/Heartran/Turni-di-Palco/actions/workflows/ci.yml)
[![Update Server Repository](https://github.com/Heartran/Turni-di-Palco/actions/workflows/update-server-repository.yml/badge.svg)](https://github.com/Heartran/Turni-di-Palco/actions/workflows/update-server-repository.yml)
[![Sync Deploy Branches](https://github.com/Heartran/Turni-di-Palco/actions/workflows/sync-deploy-branches.yml/badge.svg)](https://github.com/Heartran/Turni-di-Palco/actions/workflows/sync-deploy-branches.yml)

Turni di Palco è una Progressive Web App pensata per gestire i turni teatrali con meccaniche di gioco (XP, livelli, ruoli) per rendere l'organizzazione piu coinvolgente.

Il monorepo contiene:

- `apps/pwa`: shell PWA multipagina (Vite + TypeScript + Vanilla).
- `apps/mobile`: UI mobile React/Vite; il bundle statico finisce in `apps/pwa/public/mobile/`.
- `shared`: codice e stili condivisi.
- `docs/`: documenti di design e GDD.

## Requisiti

- Node.js 18+ (setup corrente: 22.14.0).
- npm.

## Installazione

Installa tutte le dipendenze dei workspace dalla root:

```bash
npm install
```

## Comandi disponibili

Tutti gli script vanno eseguiti dalla root con `npm run <script>`.

### Manutenzione

- `clean:builds`: elimina gli output di build standard (`dist/`, `apps/pwa/dist`, `apps/mobile/dist`) per partire da un albero pulito.

### PWA (`apps/pwa`)

- `dev:pwa`: avvia il dev server Vite su `http://localhost:5173` (host 0.0.0.0) con ricarica a caldo.
- `dev:pwa:https`: stesso server ma in HTTPS; usa le variabili `SSL_CRT_FILE`/`SSL_KEY_FILE` se impostate, altrimenti un certificato generato da Vite.
- `build:pwa`: aggiorna il nome della cache nel service worker (`apps/pwa/public/sw.js`) in base agli asset pubblici e compila la PWA in `apps/pwa/dist`.
- `preview:pwa`: serve il build gia compilato (porta 4173 per default); richiede una build precedente.
- `test:pwa`: esegue Vitest una volta sola con la configurazione in `apps/pwa/src/test/setup.ts` (`--passWithNoTests` attivo).
- `lint`: lancia ESLint sull'intero workspace PWA.
- `format`: formatta i file del workspace PWA con Prettier (modifica i file in-place).

#### Aggiornamento Service Worker

- Aggiorna le liste in `apps/pwa/public/sw.js` (`CORE_ASSETS_BY_ENV.common|prod|dev`) quando cambia un asset core o una pagina pubblica.
- La chiave della cache e calcolata automaticamente dai contenuti di `CORE_ASSETS`, quindi qualsiasi modifica agli asset core forza un nuovo cache name.
- Le pagine di sviluppo (`/dev.html` e simili) restano escluse dalla cache in produzione per evitare contenuti non pubblici.
- Dopo l'aggiornamento, esegui `npm run build:pwa` o `npm run dev:pwa` per rigenerare/servire il service worker aggiornato.

### UI mobile (`apps/mobile`)

- `dev:mobile`: avvia il dev server Vite React su `http://localhost:3000` con base `/mobile/`.
- `build:mobile`: build Vite in `apps/mobile/build` e copia il bundle statico in `apps/pwa/public/mobile/` tramite `sync:mobile`.
- `sync:mobile`: solo copia l'ultimo build da `apps/mobile/build` a `apps/pwa/public/mobile/` (scrive un checksum per saltare copie inutili).

## Struttura del codice PWA

Il sorgente della PWA vive in `apps/pwa/src` ed e suddiviso in:

- `components/`: componenti UI riutilizzabili.
- `features/`: moduli funzionali (es. gestione permessi, schede stato).
- `services/`: logica di business e integrazioni browser/API.
- `utils/`: funzioni di utilita generiche.

## Contributi

Consulta `contributing.md` per stile del codice, convenzioni di commit e setup ambiente. Per note di design vedi `docs/`.
