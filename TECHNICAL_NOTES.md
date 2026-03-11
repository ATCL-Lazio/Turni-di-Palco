# Note tecniche — Turni di Palco

## Struttura repo (high level)

- `apps/pwa`: PWA Vite multipage (entry HTML nella root del package). Asset statici in `apps/pwa/public/` (incl. `public/sw.js` e `public/mobile/`).
- `apps/mobile`: App mobile React/Vite.
- `shared/`: stili e utilità condivise.
- `tools/`: script di automazione build/copy/cache.
  - `tools/serve-dist.js` serve `apps/pwa/dist` e risolve le richieste `/mobile/*` su `apps/pwa/dist/public/mobile/*`.

## Build & run (sviluppo)

- Install: `npm install` (workspaces).
- PWA:
  - Dev: `npm run dev:pwa` / `npm run dev:pwa:https`
  - Build: `npm run build:pwa`
  - Preview: `npm run preview:pwa`
- Mobile:
  - Dev: `npm run dev:mobile`
  - Build: `npm run build:mobile`
  - Sync only: `npm run sync:mobile`
  - AI support server (local): `npm run ai:support` (default local port)
  - Dev + AI support together: `npm --workspace apps/mobile run dev:with-ai`
  - Allowlist host Vite (dev/preview): `VITE_ALLOWED_HOSTS` (comma-separated)

## AI support (mobile)

- Client calls `POST /api/ai/chat` (proxy in `apps/mobile/vite.config.ts`).
- Availability check uses `GET /health` (proxy in `apps/mobile/vite.config.ts`).
- Local server: `tools/ai-support-server.js` uses `codex exec`.
- Optional env:
  - `AI_SUPPORT_PORT` (server port, default local fallback)
  - `VITE_AI_SUPPORT_PORT` (client/proxy port, default local fallback)
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
- Il server `tools/serve-dist.js` imposta cache differenziata:
  - `no-store` per HTML, `sw.js` e manifest.
  - Cache aggressiva per asset hashed, icone e QR (immutabili).

## Routing `/mobile` (produzione)

- L'app mobile usa `base: /mobile/`.
- In produzione, `tools/serve-dist.js` risolve `/mobile/*` su `apps/pwa/dist/public/mobile/*`.
- Se si usa hosting statico esterno, garantire che `/mobile` punti a `dist/public/mobile` (o aggiungere rewrite equivalente), altrimenti `/mobile` va in 404.

## Header di sicurezza (Netlify/Render)

- Netlify: gli header sono configurati in `netlify.toml` nella sezione `[[headers]]`.
- Nota CSP: al momento `index.html` contiene uno script inline per il redirect mobile; per questo `script-src` include temporaneamente `'unsafe-inline'` finche' il bootstrap non viene spostato in un modulo esterno.
- Render: il servizio PWA usa `tools/serve-dist.js` (startCommand in `render.yaml`), quindi gli header e la cache vanno configurati lì.
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

- Camera scan: `apps/mobile/src/components/screens/QRScanner.tsx`
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

## Valutazione integrazione nuovo ruolo (badge + minigiochi + personalizzazione)

Obiettivo: introdurre un nuovo ruolo di gioco con esperienza dedicata senza frammentare la codebase, mantenendo una pipeline unica per configurazione, progressione e rollout progressivo.

### 1) Modello dati e configurazione (base unica)

- Estendere la definizione dei ruoli in DB (`public.roles`) con metadata configurabili per esperienza dedicata:
  - `role_code` stabile (es. `dramaturg`, `tech_lead`, ...),
  - copy/UI (titolo, descrizione breve, tone of voice),
  - mapping verso badge consigliati,
  - mapping verso minigiochi abilitati.
- Evitare logica hardcoded lato client: i mapping vanno caricati da config (`role_profile`) così da poter fare tuning senza rebuild completo.
- Mantenere retrocompatibilità: se il profilo ruolo non è disponibile, fallback su esperienza standard.

### 2) Badge dedicati al ruolo

- Strategia badge consigliata:
  - badge trasversali (già esistenti) restano invariati,
  - badge specifici del nuovo ruolo aggiunti in `public.badges` con naming coerente (`role_<role_code>_<milestone>`),
  - visibilità iniziale controllata (es. `hidden`/`secret`) per reveal progressivo.
- Evoluzione raccomandata di `evaluate_badges_for_user`:
  - includere regole basate su `profiles.role_id` + metriche minigioco,
  - separare regole “globali” da regole “role-specific” (CTE/moduli SQL distinti) per mantenibilità.
- Trigger di assegnazione: conservare il modello attuale event-driven, estendendo gli eventi che possono assegnare badge (esito minigioco, streak, missioni).

### 3) Minigiochi dedicati

- Basare l'integrazione sul catalogo già esistente lato mobile (`apps/mobile/src/gameplay/minigames.ts`) introducendo:
  - `allowedRoles` per minigioco,
  - difficulty/scoring profile opzionale per ruolo,
  - reward mapping (token/reputation/badge progress).
- Aggiungere telemetria minima per minigioco:
  - tentativi,
  - completamenti,
  - best score,
  - tempo medio.
- Usare questa telemetria sia per progressione utente sia per tuning live delle soglie badge.

### 4) Personalizzazione UX per ruolo

- Onboarding: dopo `role-selection`, mostrare una “role journey card” con:
  - obiettivi iniziali,
  - primo minigioco consigliato,
  - badge di avvio ottenibili.
- Home: ordinare widget e CTA in base al ruolo (senza duplicare schermate intere).
- Notifiche: priorità ai messaggi in linea col ruolo (nuovo badge di ruolo, sfida giornaliera, evento coerente col focus role).
- Progressione: introdurre missioni settimanali a tema ruolo come layer sopra il sistema reputazione già esistente.

### 5) Piano di rollout (sicuro)

1. **Schema/config readiness**
   - aggiunta metadata ruolo e mapping badge/minigiochi,
   - feature flag dedicata (mobile + backend).
2. **Badge role-specific (dark launch)**
   - regole deployate ma non visibili globalmente,
   - verifica metriche in ambiente controllato.
3. **Minigiochi role-gated**
   - abilitazione solo per utenti del nuovo ruolo,
   - tuning di scoring e reward.
4. **UX personalization**
   - onboarding e home contestuale,
   - notifiche dedicate.
5. **A/B o progressive rollout**
   - monitorare retention D1/D7, completion minigiochi, unlock badge,
   - espansione graduale ad altri ruoli se KPI positivi.

### 6) KPI minimi per validazione

- Activation del ruolo: % utenti che completano onboarding dedicato.
- Engagement: sessioni medie con almeno 1 interazione role-specific.
- Minigiochi: completion rate e retry rate.
- Badge: tempo medio al primo badge ruolo e numero badge ruolo/utente.
- Retention: confronto D1/D7 tra utenti con e senza personalizzazione ruolo.

### 7) Rischi e mitigazioni

- **Rischio:** esplosione complessità per ruolo.
  - **Mitigazione:** config-driven architecture, componenti UI riusabili, no fork per ruolo.
- **Rischio:** badge troppo facili/difficili.
  - **Mitigazione:** soglie tunabili server-side + osservabilità settimanale.
- **Rischio:** minigiochi non coerenti col ruolo.
  - **Mitigazione:** playlist per ruolo con gating progressivo e test qualitativi rapidi.
- **Rischio:** regressioni su utenti attuali.
  - **Mitigazione:** feature flags + fallback default + rollout progressivo.
