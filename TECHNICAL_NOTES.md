# Note tecniche — Turni di Palco

## Struttura repo (high level)

- `apps/pwa`: PWA Vite multipage (entry HTML nella root del package). Asset statici in `apps/pwa/public/` (incl. `public/sw.js` e `public/mobile/`).
- `apps/mobile`: Mobile UI (React/Vite). Build copiato in `apps/pwa/public/mobile/` tramite script di sync.
- `shared/`: stili e utilità condivise.
- `tools/`: script di automazione build/copy/cache.
  - `tools/serve-dist.js` risolve le richieste `/mobile/*` su `apps/pwa/dist/public/mobile/*` in produzione.

## Build & run (sviluppo)

- Install: `npm install` (workspaces).
- PWA:
  - Dev: `npm run dev:pwa` / `npm run dev:pwa:https`
  - Build: `npm run build:pwa`
  - Preview: `npm run preview:pwa`
- Mobile:
  - Dev/build: `npm --workspace apps/mobile run dev|build`
  - AI support server (local): `npm run ai:support` (default port 8787)
  - Dev + AI support together: `npm --workspace apps/mobile run dev:with-ai`
  - Build+sync in PWA: `npm run build:mobile`

## AI support (mobile)

- Client calls `POST /api/ai/chat` (proxy in `apps/mobile/vite.config.ts`).
- Availability check uses `GET /health` (proxy in `apps/mobile/vite.config.ts`).
- Local server: `tools/ai-support-server.js` uses `codex exec`.
- Optional env:
  - `AI_SUPPORT_PORT` (server port, default 8787)
  - `VITE_AI_SUPPORT_PORT` (client/proxy port, default 8787)
  - `AI_SUPPORT_ALLOWED_ORIGINS` (comma-separated allowlist; default deny if unset)
  - `AI_SUPPORT_API_KEY` (opzionale ma consigliata: se presente, protegge `/api/ai/chat` e `/api/ai/issue`; inviare `Authorization: Bearer ...` o `X-AI-SUPPORT-TOKEN`)
  - `AI_SUPPORT_RATE_LIMIT_MAX` (rate limit requests per window, default 60)
  - `AI_SUPPORT_RATE_LIMIT_WINDOW_MS` (rate limit window in ms, default 60000)
  - `AI_SUPPORT_ADMIN_ENABLED` (admin endpoints `/auth` + `/auth/command`; default false)
  - `VITE_AI_SUPPORT_ENDPOINT` (client endpoint override)
  - `VITE_AI_SUPPORT_ISSUE_ENDPOINT` (issue endpoint override)
- CORS: if the health endpoint is reached cross-origin, the server must reply with
  `Access-Control-Allow-Origin` matching the calling origin (or `*`) so the browser can
  read the response in `mode: "cors"`. In dev, prefer the same-origin `/health` proxy.

## PWA, cache e aggiornamenti

- Service Worker: `apps/pwa/public/sw.js`
- Il versioning della cache viene aggiornato dallo script `tools/update-cache-version.js` (invocato da `npm run build:pwa`) per forzare l’update degli asset core.

## Header di sicurezza (Netlify/Render)

- Netlify: gli header sono configurati in `netlify.toml` nella sezione `[[headers]]`.
- Nota CSP: al momento `index.html` contiene uno script inline per il redirect mobile; per questo `script-src` include temporaneamente `'unsafe-inline'` finche' il bootstrap non viene spostato in un modulo esterno.
- Render: il servizio PWA attuale usa `vite preview` (startCommand in `render.yaml`), quindi gli header vanno impostati a livello di reverse proxy o server applicativo.
  - Opzione consigliata: mettere un reverse proxy (es. Caddy/Nginx) davanti al preview server e impostare gli header lì.
  - In alternativa: sostituire il preview server con un piccolo server (Express/Fastify) che serva `apps/pwa/dist` e imposti gli stessi header.
  - Se si migra la PWA a “Static Site” su Render, utilizzare il supporto ai `headers` del manifest Render.

## Supabase (client)

- Configurazione lato client tramite variabili d’ambiente (vedi `.env`, `apps/mobile/.env.example`, `apps/pwa/.env.example`).
- Auth: login/signup tramite `supabase.auth.*` (per comportamento e policy: verificare impostazioni progetto Supabase, es. email verification).

## QR: modello funzionale (attivazione codice)

Obiettivo: introdurre un sistema di attivazione/riscatto che trasforma i codici biglietto (TicketOne/VivaTicket/…) in hash e li gestisce a DB.

Flusso proposto:

1. Il codice biglietto viene normalizzato e hashato (SHA-256).

2. L’hash viene controllato per unicità a DB.
   - In caso di collisione: reroll/strategia di disambiguazione (es. payload JSON più ricco) per garantire unicità.
3. Generazione di un QR code da far scansionare in app.
4. Scansione:
   - Verifica a DB dello stato del codice.
   - Se non è attivo: richiesta conferma per l’attivazione.
5. Attivazione:
   - Il codice viene marcato come attivo e associato all’utente che lo ha riscattato.

## QR: scansione in app (stato attuale)

- UI/Camera scan: `apps/mobile/src/components/screens/QRScanner.tsx`
  - Usa `navigator.mediaDevices.getUserMedia` + decoding con `jsqr`.
  - La fotocamera funziona solo in **secure context** (HTTPS o `localhost`).

### Validazione QR (evita “QR qualsiasi”)

Problema: un QR generico (es. QR di un prodotto) veniva interpretato come valido e portava alla conferma evento.

Mitigazione implementata (provvisoria, fino all’integrazione DB):

- `apps/mobile/src/App.tsx`: lo scan viene accettato solo se il contenuto include un ID evento noto (es. `ATCL-001`).

- `apps/mobile/src/components/screens/QRScanner.tsx`: mostra errore “QR non valido” e riprende la scansione.

Nota: attualmente l’elenco eventi è mock (`apps/mobile/src/state/store.tsx`, `events`). Con Supabase il controllo dovrà diventare:

- lookup/validazione su tabella biglietti/QR,

- verifica stato (attivo/non attivo),
- redemption atomico con associamento all’utente.

## Eventi ATCL: feed, import e follow

- Script import: `tools/import-spazio-rossellini-events.js` (usa `.env` con `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`). Supporta `DRY_RUN` per test.
- Edge Function: `supabase/functions/import-spazio-rossellini` (deployata). Endpoint: `https://<project>.supabase.co/functions/v1/import-spazio-rossellini`.
- Automatizzazione consigliata via cron: `*/30 * * * *` (import ogni 30 minuti).
- Follow eventi: tabella `public.followed_events` (RLS per user). Home mostra solo eventi seguiti, Turni ATCL mostra tutti gli eventi e permette follow/unfollow.

## Supabase: pg_net e cron import (2026-01-12)

- `pg_net` spostato fuori da `public` tramite drop/recreate in schema `extensions` (non supporta `ALTER EXTENSION ... SET SCHEMA`).
- Le funzioni restano in schema `net` (es. `net.http_post`), con grant gestiti dall'event trigger `issue_pg_net_access`.
- Cron job attivo: `import-spazio-rossellini-every-30-min` con schedule `*/30 * * * *`, usa `net.http_post` per chiamare l'edge function `import-spazio-rossellini`.
- Nota: se `pg_net` viene droppato, il job fallisce finche' non viene ricreato.
- Advisors performance: aggiunti indici FK mancanti (incluso `followed_events.event_id`), policy RLS aggiornate con `(select auth.uid())` per evitare re-evaluation per riga. Le segnalazioni di "unused index" possono persistere finche' le query non usano gli indici.

## Eventi: dettaglio e calendario

- Pagina dettagli evento: `apps/mobile/src/components/screens/EventDetails.tsx`.
- Export calendario: genera un file `.ics` locale usando `event_date` + `event_time` dal feed/DB. Parsing date gestisce formati tipo `01 Feb 2026` e varianti numeriche.

## Navigazione mappe (mobile)

- iOS: usa `maps://?q=...` per Apple Maps (nessun fallback web per evitare doppio launch).
- Android: usa `geo:0,0?q=...`.
- Desktop: fallback su Google Maps web.
