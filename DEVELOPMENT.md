---
layout: default
permalink: /development/
title: Documentazione tecnica
description: Guida tecnica e architettura del progetto Turni di Palco
---

# Turni di Palco — Documentazione tecnica

[![Netlify Status](https://api.netlify.com/api/v1/badges/82f90be3-aaed-4dcc-8a21-8ee00395d6eb/deploy-status)](https://app.netlify.com/projects/turni-di-palco/deploys)
[![Cleanup Old Events](https://github.com/Heartran/Turni-di-Palco/actions/workflows/cleanup-events.yml/badge.svg)](https://github.com/Heartran/Turni-di-Palco/actions/workflows/cleanup-events.yml)
[![CI](https://github.com/Heartran/Turni-di-Palco/actions/workflows/ci.yml/badge.svg)](https://github.com/Heartran/Turni-di-Palco/actions/workflows/ci.yml)
[![Sync Deploy Branches](https://github.com/Heartran/Turni-di-Palco/actions/workflows/sync-deploy-branches.yml/badge.svg)](https://github.com/Heartran/Turni-di-Palco/actions/workflows/sync-deploy-branches.yml)
[![Security Checks](https://github.com/Heartran/Turni-di-Palco/actions/workflows/security.yml/badge.svg)](https://github.com/Heartran/Turni-di-Palco/actions/workflows/security.yml)
[![Last Commit](https://turni-di-palco-badges.onrender.com/github/last-commit/Heartran/Turni-di-Palco?label=Last%20commit&logo=github)](https://github.com/Heartran/Turni-di-Palco/commits/main)
[![Open Issues](https://turni-di-palco-badges.onrender.com/github/issues/Heartran/Turni-di-Palco?label=Open%20issues&logo=github)](https://github.com/Heartran/Turni-di-Palco/issues)
[![App Version](https://turni-di-palco-badges.onrender.com/endpoint?url=https%3A%2F%2Fturni-di-palco-control-plane.onrender.com%2Fapi%2Fbadges%2Fmobile-version)](supabase/functions/app-version/index.ts)
[![Node.js](https://img.shields.io/badge/node-18%2B%20(recommended%3A%2022.14.0)-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![PWA Stack](https://img.shields.io/badge/PWA-Vite%207-646CFF?logo=vite&logoColor=white)](apps/pwa/package.json)
[![Tests](https://img.shields.io/badge/tests-Vitest-6E9F18?logo=vitest&logoColor=white)](apps/pwa/package.json)

---

## Approfondimenti

- [Note tecniche]({{ '/development/technical_notes/' | relative_url }}): architettura, QR, Supabase, ticketing e note operative.

---

## Stato dei Deploy

| Piattaforma | Stato | URL | QR |
|-------------|-------|-----|-----|
| Render | [![Render](https://turni-di-palco-badges.onrender.com/website?url=https%3A%2F%2Fturni-di-palco-fq85.onrender.com&label=stato&logo=render&logoColor=white&up_message=online&down_message=offline&up_color=brightgreen&down_color=red)](https://turni-di-palco-fq85.onrender.com) | [turni-di-palco-fq85.onrender.com](https://turni-di-palco-fq85.onrender.com) | ![QR Render](https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https%3A%2F%2Fturni-di-palco-fq85.onrender.com) |
| Railway | [![Railway](https://turni-di-palco-badges.onrender.com/website?url=https%3A%2F%2Fturni-di-palco-production.up.railway.app&label=stato&logo=railway&logoColor=white&up_message=online&down_message=offline&up_color=brightgreen&down_color=red)](https://turni-di-palco-production.up.railway.app) | [turni-di-palco-production.up.railway.app](https://turni-di-palco-production.up.railway.app) | ![QR Railway](https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https%3A%2F%2Fturni-di-palco-production.up.railway.app) |
| Vercel | [![Vercel](https://turni-di-palco-badges.onrender.com/website?url=https%3A%2F%2Fturni-di-palco.vercel.app&label=stato&logo=vercel&logoColor=white&up_message=online&down_message=offline&up_color=brightgreen&down_color=red)](https://turni-di-palco.vercel.app) | [turni-di-palco.vercel.app](https://turni-di-palco.vercel.app) | ![QR Vercel](https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https%3A%2F%2Fturni-di-palco.vercel.app) |
| Netlify | [![Netlify](https://turni-di-palco-badges.onrender.com/website?url=https%3A%2F%2Fturni-di-palco.netlify.app&label=stato&logo=netlify&logoColor=white&up_message=online&down_message=offline&up_color=brightgreen&down_color=red)](https://turni-di-palco.netlify.app) | [turni-di-palco.netlify.app](https://turni-di-palco.netlify.app) | ![QR Netlify](https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https%3A%2F%2Fturni-di-palco.netlify.app) |

---

## Struttura del repository

- `apps/pwa`: applicazione web principale.
- `apps/mobile`: interfaccia mobile.
- `shared`: risorse condivise tra moduli.
- `docs/`: materiali di progetto e design.

---

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

---

## Dev Dashboard + Control Plane

Architettura attuale (v0.6):

- Entrypoint operativo unico: `/` (Ops Dashboard single-page con pannelli dinamici via `?panel=`).
- URL legacy (`/mobile-ops.html`, `/mobile-runtime.html`, `/mobile-data-ops.html`, ecc.) restano supportati ma fanno redirect verso la dashboard.
- `control-plane.html` resta disponibile come modulo tecnico (embed/apertura diretta) e supporta deeplink preset (`view`, `command`, `target`, `dryRun`, `payload`, `source`).

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

- `VITE_DEV_CONTROL_PLANE_URL` (default locale: `http://localhost:<control-plane-port>`)
- `CONTROL_PLANE_ALLOWED_ORIGINS`
- `CONTROL_PLANE_ALLOWED_EMAILS`
- `CONTROL_PLANE_RATE_LIMIT_PER_MIN`
- `CONTROL_PLANE_CONFIRM_TTL_MS`
- `RENDER_API_KEY`
- `RENDER_SERVICE_IDS_JSON`

### Flags Explorer (Vercel Toolbar)

La PWA espone il discovery endpoint richiesto dal Toolbar:

- `/.well-known/vercel/flags`

Note operative:

- È configurato `overrideEncryptionMode: plaintext` (setup custom): gli override arrivano dal cookie `vercel-flag-overrides`.
- Gli override Toolbar hanno priorità alta in runtime su PWA e mobile web.
- In assenza del cookie Toolbar il comportamento resta invariato:
  - PWA: env + override locali/runtime.
  - Mobile: Supabase/cache/default.

Esempi deeplink Control Plane:

- `/control-plane.html?view=commands&command=render.deployments.trigger&dryRun=true`
- `/control-plane.html?view=db&command=supabase.db.read&dryRun=true`
- `/control-plane.html?view=mobile-flags`

### Deploy Render

- `render.yaml` include il servizio `Turni-di-Palco-Control-Plane` con `buildCommand`/`startCommand` dedicati.
- `render.yaml` include anche `Turni-di-Palco-Badges` (Shields self-hosted) per badge su repository privata.
- Il badge `App Version` passa da `Turni-di-Palco-Control-Plane` (`/api/badges/mobile-version`) e legge la stessa versione usata dalla schermata impostazioni mobile (`app-version` su Supabase).
- Per evitare valori letterali `${...}` nel Blueprint, configura come variabili reali in Render:
  `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` su `Maxwell-AI-Support`;
  `SUPABASE_URL` e `SUPABASE_ANON_KEY` su `Turni-di-Palco-Control-Plane`.
- Imposta `GH_TOKEN` sul servizio badges con permessi di lettura del repository (classic PAT: `repo`; fine-grained: metadata + contents + issues in read).
- Se Render assegna un dominio diverso da `turni-di-palco-badges.onrender.com`, aggiorna i badge in testa a questo documento.

### Deploy GitHub (`sync-deploy-branches.yml`)

- Il workflow traccia i deployment per tutti i servizi Render attivi: `Turni-di-Palco`, `Maxwell-AI-Support`, `Turni-di-Palco-Control-Plane`, `Turni-di-Palco-Badges`.
- Secrets richiesti: `RENDER_API_KEY`, `RENDER_SERVICE_ID_TURNI`, `RENDER_SERVICE_ID_MAXWELL`, `RENDER_SERVICE_ID_CONTROL_PLANE`, `RENDER_SERVICE_ID_BADGES`.

---

## Ticket QR Generator

All'interno della cartella `tools/ticket_qr_generator` si trova lo script per generare i QR Code dei ticket, utilizzabile dalle biglietterie.

Per utilizzare lo script, eseguire da linea di comando:

```bash
python ticket_qr_generator.py
```

oppure aprire il file `ticket_qr_generator_ui.py` con un editor di testo e eseguirlo.

![Screenshot dell'app]({{ '/assets/images/Screenshot 2026-02-27 121448.png' | relative_url }})
