# Note tecniche — Turni di Palco

## Struttura repo (high level)

- `apps/pwa`: PWA Vite multipage (entry HTML nella root del package). Asset statici in `apps/pwa/public/` (incl. `public/sw.js` e `public/mobile/`).
- `apps/mobile`: Mobile UI (React/Vite). Build copiato in `apps/pwa/public/mobile/` tramite script di sync.
- `shared/`: stili e utilità condivise.
- `tools/`: script di automazione build/copy/cache.

## Build & run (sviluppo)

- Install: `npm install` (workspaces).
- PWA:
  - Dev: `npm run dev:pwa` / `npm run dev:pwa:https`
  - Build: `npm run build:pwa`
  - Preview: `npm run preview:pwa`
- Mobile:
  - Dev/build: `npm --workspace apps/mobile run dev|build`
  - Build+sync in PWA: `npm run build:mobile`

## PWA, cache e aggiornamenti

- Service Worker: `apps/pwa/public/sw.js`
- Il versioning della cache viene aggiornato dallo script `tools/update-cache-version.js` (invocato da `npm run build:pwa`) per forzare l’update degli asset core.

## Supabase (client)

- Configurazione lato client tramite variabili d’ambiente (vedi `.env` / `apps/mobile/.env.example`).
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
- Automatizzazione consigliata via cron: `0 * * * *` (import orario).
- Follow eventi: tabella `public.followed_events` (RLS per user). Home mostra solo eventi seguiti, Turni ATCL mostra tutti gli eventi e permette follow/unfollow.

## Eventi: dettaglio e calendario

- Pagina dettagli evento: `apps/mobile/src/components/screens/EventDetails.tsx`.
- Export calendario: genera un file `.ics` locale usando `event_date` + `event_time` dal feed/DB. Parsing date gestisce formati tipo `01 Feb 2026` e varianti numeriche.

## Navigazione mappe (mobile)

- iOS: usa `maps://?q=...` per Apple Maps (nessun fallback web per evitare doppio launch).
- Android: usa `geo:0,0?q=...`.
- Desktop: fallback su Google Maps web.
