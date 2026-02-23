# Turni di Palco
[![Mobile Build](https://github.com/Heartran/Turni-di-Palco/actions/workflows/mobile-build.yml/badge.svg)](https://github.com/Heartran/Turni-di-Palco/actions/workflows/mobile-build.yml)
[![Cleanup Old Events](https://github.com/Heartran/Turni-di-Palco/actions/workflows/cleanup-events.yml/badge.svg)](https://github.com/Heartran/Turni-di-Palco/actions/workflows/cleanup-events.yml)
[![CI](https://github.com/Heartran/Turni-di-Palco/actions/workflows/ci.yml/badge.svg)](https://github.com/Heartran/Turni-di-Palco/actions/workflows/ci.yml)
[![Update Server Repository](https://github.com/Heartran/Turni-di-Palco/actions/workflows/update-server-repository.yml/badge.svg)](https://github.com/Heartran/Turni-di-Palco/actions/workflows/update-server-repository.yml)
[![Sync Deploy Branches](https://github.com/Heartran/Turni-di-Palco/actions/workflows/sync-deploy-branches.yml/badge.svg)](https://github.com/Heartran/Turni-di-Palco/actions/workflows/sync-deploy-branches.yml)
[![Security Checks](https://github.com/Heartran/Turni-di-Palco/actions/workflows/security.yml/badge.svg)](https://github.com/Heartran/Turni-di-Palco/actions/workflows/security.yml)
[![Last Commit](https://turni-di-palco-badges.onrender.com/github/last-commit/Heartran/Turni-di-Palco?label=Last%20commit&logo=github)](https://github.com/Heartran/Turni-di-Palco/commits/main)
[![Open Issues](https://turni-di-palco-badges.onrender.com/github/issues/Heartran/Turni-di-Palco?label=Open%20issues&logo=github)](https://github.com/Heartran/Turni-di-Palco/issues)
[![App Version](https://turni-di-palco-badges.onrender.com/endpoint?url=https%3A%2F%2Fturni-di-palco-control-plane.onrender.com%2Fapi%2Fbadges%2Fmobile-version)](supabase/functions/app-version/index.ts)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18%20%7C%2022.14.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![PWA Stack](https://img.shields.io/badge/PWA-Vite%207-646CFF?logo=vite&logoColor=white)](apps/pwa/package.json)
[![Tests](https://img.shields.io/badge/tests-Vitest-6E9F18?logo=vitest&logoColor=white)](apps/pwa/package.json)

Turni di Palco è un progetto che unisce spettacolo dal vivo e gioco digitale.
L’obiettivo è semplice: vivere il teatro in modo più attivo, scoprendo non solo la scena ma anche tutto il lavoro dietro le quinte.


![Icona app](apps/pwa/public/icons/badge.png)

## Cos'è

Turni di Palco è una app in cui l’utente costruisce una carriera teatrale virtuale.
La progressione non dipende solo dal gioco: cresce davvero quando si partecipa agli eventi reali del circuito.

## A chi serve

- Giovani e studenti che vogliono avvicinarsi al teatro in modo coinvolgente.
- Spettatori e appassionati che vogliono capire meglio i mestieri dello spettacolo.
- Scuole e operatori culturali che cercano uno strumento educativo pratico e moderno.

## Perché è utile

- Incentiva la partecipazione reale agli spettacoli.
- Valorizza professioni spesso poco visibili (luci, suono, palco, organizzazione).
- Trasforma l’esperienza teatrale in un percorso di crescita personale.
- Favorisce continuità: non è un evento isolato, ma un percorso nel tempo.

## Come funziona in breve

1. Crei un profilo scegliendo un ruolo teatrale.
2. Completi attività rapide e sfide narrative.
3. Registri la presenza agli eventi tramite QR code.
4. Guadagni esperienza, reputazione e nuovi traguardi.

<a href="https://turni-di-palco-fq85.onrender.com/mobile"><img src=".temp/qrcodes/RenderStaticQR.png" alt="RenderStaticQR" width="200" height="200" style="margin: 20px;"></a>

## Struttura del repository

- `apps/pwa`: applicazione web principale.
- `apps/mobile`: interfaccia mobile.
- `shared`: risorse condivise tra moduli.
- `docs/`: materiali di progetto e design.

## Avvio rapido (sviluppo)

Prerequisiti:

- Node.js 18+ (setup corrente: 22.14.0)
- npm

Installazione:

```bash
npm install
```

Comandi principali:

```bash
npm run dev:pwa
npm run dev:pwa:https
npm run dev:control-plane
npm run dev:control-plane:https
npm run start:control-plane
npm run build:pwa
npm run test:pwa
```

## Dev Dashboard + Control Plane

Configurazione locale consigliata:

1. Imposta le variabili da `.env.example` (root) e `apps/pwa/.env.example`.
2. Avvia la dashboard PWA in HTTPS:

```bash
npm run dev:pwa:https
```

3. In un secondo terminale avvia il control-plane:

```bash
npm run dev:control-plane:https
```

Variabili principali:

- `VITE_DEV_CONTROL_PLANE_URL` (default locale: `http://localhost:8787`)
- `CONTROL_PLANE_ALLOWED_ORIGINS`
- `CONTROL_PLANE_ALLOWED_EMAILS`
- `CONTROL_PLANE_RATE_LIMIT_PER_MIN`
- `CONTROL_PLANE_CONFIRM_TTL_MS`
- `RENDER_API_KEY`
- `RENDER_SERVICE_IDS_JSON`

Deploy Render:

- `render.yaml` include il servizio `Turni-di-Palco-Control-Plane` con `buildCommand`/`startCommand` dedicati.
- `render.yaml` include anche `Turni-di-Palco-Badges` (Shields self-hosted) per badge su repository privata.
- Il badge `App Version` passa da `Turni-di-Palco-Control-Plane` (`/api/badges/mobile-version`) e legge la stessa versione usata dalla schermata impostazioni mobile (`app-version` su Supabase).
- Per evitare valori letterali `${...}` nel Blueprint, configura come variabili reali in Render:
  `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` su `Maxwell-AI-Support`;
  `SUPABASE_URL` e `SUPABASE_ANON_KEY` su `Turni-di-Palco-Control-Plane`.
- Imposta `GH_TOKEN` sul servizio badges con permessi di lettura del repository (classic PAT: `repo`; fine-grained: metadata + contents + issues in read).
- Se Render assegna un dominio diverso da `turni-di-palco-badges.onrender.com`, aggiorna i due badge in testa al README.

Deploy GitHub (`sync-deploy-branches.yml`):

- Il workflow traccia i deployment per tutti i servizi Render attivi: `Turni-di-Palco`, `Maxwell-AI-Support`, `Turni-di-Palco-Control-Plane`, `Turni-di-Palco-Badges`.
- Secrets richiesti: `RENDER_API_KEY`, `RENDER_SERVICE_ID_TURNI`, `RENDER_SERVICE_ID_MAXWELL`, `RENDER_SERVICE_ID_CONTROL_PLANE`, `RENDER_SERVICE_ID_BADGES`.

## Contributi

Per linee guida di collaborazione e convenzioni di sviluppo, vedi [CONTRIBUTING.md](CONTRIBUTING.md).
