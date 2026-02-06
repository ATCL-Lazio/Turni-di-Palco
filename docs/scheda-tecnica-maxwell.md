# Scheda tecnica di Maxwell e ricostruzione del repository Turni-di-Palco

## Fonti interne e limiti pratici dell’analisi

Questa scheda è ricostruita **partendo dai file effettivamente reperiti** dal repository e incrociando, quando serve, la documentazione ufficiale dei servizi esterni impiegati (hosting, autenticazione, CLI, API). In particolare, per la parte “repo”, la ricostruzione poggia su questi artefatti interni: `README.md`, `render.yaml`, `tools/ai-support-server.js`, `.gitignore`.

Una nota importante: vari altri file della repo (workflow CI, altri script `tools/`, porzioni di `apps/`) non sono risultati leggibili tramite il canale di lettura in questa sessione. Quindi la sezione “intero repository” è una **mappa ragionata e coerente con ciò che è osservabile**, ma non può pretendere di essere una radiografia completa di ogni dipendenza e ogni modulo (per quello servirebbero anche i `package.json` e i workflow). Il focus, come richiesto, è portare al massimo la ricostruzione **a partire da ciò che c’è** e isolare bene **Maxwell**.

## Panoramica del repository e intenti del progetto

Dal `README.md` emerge che **Turni di Palco** è una app che unisce esperienza teatrale dal vivo e “gioco digitale”, con progressione legata anche alla partecipazione reale registrata via QR e attività “narrative”/sfide. La repo dichiara una struttura a moduli con almeno: `apps/pwa` (app web principale), `apps/mobile` (interfaccia mobile), `shared` (asset condivisi), e `docs` (materiali). Sempre dal `README.md`, l’ambiente di sviluppo dichiara prerequisiti `Node.js 18+` con “setup corrente: 22.14.0”, e comandi tipici di dev/build/test orientati alla PWA (ad esempio `npm run dev:pwa`, `npm run build:pwa`, `npm run test:pwa`).  

Nel `README.md` è presente anche un link pubblico alla versione deployata (con QR) che punta alla route `/mobile` sul dominio di deploy Render; questo dettaglio è utile perché torna anche nella configurazione CORS di Maxwell e nel blueprint di deploy.

## Topologia di deploy e componenti runtime

Il file `render.yaml` (esportato con timestamp **2026-01-16T13:19:18Z**) definisce una topologia a **due servizi web** su entity["company","Render","cloud hosting platform"], entrambi runtime Node e collocati in region `frankfurt`:

- **Turni-di-Palco**: servizio principale, build `npm ci && npm run build:mobile && npm run build:pwa`, start tramite uno script di preview/serve della PWA che ascolta su `0.0.0.0` e porta `$PORT`.
- **Maxwell-AI-Support**: servizio dedicato (Maxwell), build `npm ci` + install global di `@openai/codex` e `gh`, start `npm run ai:support`.

Entrambi i servizi leggono variabili `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (in Maxwell sono interpolate da variabili “sorelle”, mentre nel servizio Turni sono dichiarate con `sync: false`). Il significato operativo di `sync: false` (“Render ignora variabili con sync: false quando si aggiorna un Blueprint; e non le include nei preview environments”) è esplicitato nella spec del blueprint Render. citeturn1search1

Maxwell, sempre in `render.yaml`, definisce `AI_SUPPORT_ALLOWED_ORIGINS` includendo il dominio deploy e anche lo stesso dominio con suffisso `/mobile`. Questo combacia con lo schema CORS implementato nel server Maxwell (sezione successiva), e con l’idea che l’interfaccia mobile possa chiamare le API di Maxwell dal browser installato/embedded.

## Maxwell come componente: scopo, dipendenze e responsabilità

**Maxwell** nel repository è implementato principalmente nello script `tools/ai-support-server.js`, che è un server Node “puro” (usa `node:http` / `node:https`), non un framework tipo Express. Il servizio nasce per fare da **control-plane** di supporto, con due funzioni centrali:

- una **chat API** (`/api/ai/chat`) che costruisce un prompt testuale a partire da `messages` + contesto e invoca **Codex CLI** come motore di risposta;
- una **issue API** (`/api/ai/issue`) che crea o aggiorna issue su entity["company","GitHub","code hosting platform"] usando **GitHub CLI** (`gh`) come prima scelta e una **fallback** su GitHub REST API quando la CLI fallisce.

Dal punto di vista “di prodotto”, Maxwell è una specie di “stanza regia”: si mette tra UI (probabilmente `/mobile`) e automazioni/strumenti (Codex, GitHub), e fornisce anche un **dashboard HTML** (route `/`) per monitorare stato, uptime, memoria, autenticazione e health.

Maxwell incentra la parte LLM su **Codex CLI**: dalla documentazione ufficiale, Codex CLI è un “coding agent” eseguibile da terminale, installabile via `npm i -g @openai/codex`, con modalità interactive e scripting (`exec`). citeturn2search2  
L’autenticazione di Codex CLI su ambienti headless supporta un flusso device-code con comando `codex login --device-auth` e caching dei token in `~/.codex/auth.json`. citeturn2search3

## Surface API e flussi operativi di Maxwell

### Endpoint esposti e semantica “di servizio”

Dallo script `tools/ai-support-server.js`, Maxwell espone (almeno) queste route:

- `GET /` → dashboard HTML “Maxwell Server Dashboard” con snapshot dello stato e UI per avviare flussi di login (se admin abilitato).
- `GET /health` → JSON `{ status: 'ok', service: 'ai-support', uptime: ... }`.
- `POST /api/ai/chat` → JSON con `reply` generata da Codex CLI.
- `POST /api/ai/issue` → crea/commenta issue e risponde con metadati (URL, flag `existing`, azione eseguita).
- `GET /auth` e `POST /auth/command` → endpoint admin (protetti da flag) per controllare/avviare login Codex e GitHub.

La porta è determinata in modo “cloud-friendly”: prima `process.env.PORT`, poi `AI_SUPPORT_PORT` o `VITE_AI_SUPPORT_PORT`, fallback `8787`. L’host è risolto in modo diverso in locale vs entity["company","Render","cloud hosting platform"]: su Render viene forzato `0.0.0.0` per consentire il binding corretto della porta del servizio.

### Flusso chat: costruzione prompt e invocazione Codex CLI

Il flusso `/api/ai/chat` è deliberatamente semplice (e robusto da deployare): Maxwell prende `prompt`, `messages[]` e `context` (supporta almeno `userName` e `memory`), compone un testo lineare Multi-turn con prefissi `System:`, `User:` e `Assistant:` e poi invoca `codex exec ... -` passando il prompt su `stdin`.

L’invocazione di Codex CLI avviene in modalità “scripting” con `exec`, e Maxwell usa un file temporaneo di output per recuperare “l’ultimo messaggio” tramite flag `--output-last-message <path>`. Questo è coerente con l’idea di “automatizzare workflow ripetibili” via `exec` (Codex CLI come tool invocabile da processi esterni). citeturn2search2

Per l’autenticazione, Maxwell include una parte piuttosto articolata: può “idratare” un set token/credenziali in un file `auth.json` nello stile `~/.codex/auth.json` e/o avviare un device-flow (`codex login --device-auth`) quando gira in ambienti headless. La doc ufficiale spiega esplicitamente sia la posizione `~/.codex/auth.json` sia la modalità device-code per contesti remoti/headless. citeturn2search3

### Flusso issue: GitHub CLI come preferenza, REST API come fallback

L’endpoint `/api/ai/issue` è progettato per essere **più protetto** della chat:

- richiede un token dedicato (`AI_SUPPORT_API_TOKEN` o `AI_SUPPORT_ISSUE_TOKEN`) che può essere inviato come `x-ai-support-token` oppure `Authorization: Bearer ...`;
- in caso di assenza o mismatch, risponde `401 Unauthorized` (o `503` se il token richiesto non è configurato).

Quando l’autorizzazione è ok, Maxwell:
1. normalizza `title` e `body`;
2. gestisce `labels` (accetta labels richieste dal client ma aggiunge anche labels “base”, in particolare `supporto` e `Maxwell`, e prova a crearle se non esistono);
3. cerca un’issue già aperta con lo stesso titolo; se esiste, commenta e aggiorna labels; se non esiste, crea una nuova issue.

Sulla parte REST, Maxwell implementa internamente chiamate a endpoint standard GitHub (create issue, list issues, list/create labels, comment, add labels), includendo header consigliati come `Accept: application/vnd.github+json` e la versione API (`X-GitHub-Api-Version`). Gli endpoint “Create an issue” e “Labels endpoints” sono documentati ufficialmente da GitHub. citeturn2search1turn1search0

Maxwell prova prima la strada `gh` (GitHub CLI), poi ripiega su REST API se la CLI fallisce. La CLI, secondo doc, supporta sia login interattivo sia l’uso headless via token d’ambiente (`GH_TOKEN`) ed è adatta proprio a scenari di automazione. citeturn2search5

Per la resilienza, quando usa REST API Maxwell implementa gestione rate limit (riconosce `403/429` e legge `x-ratelimit-remaining`, `x-ratelimit-reset`, oltre a `retry-after` per secondary limits), con piccoli retry e backoff. La semantica dei rate limit header e dei comportamenti corretti quando `x-ratelimit-remaining` va a `0` è descritta nelle linee guida GitHub sui rate limits. citeturn2search0

## Configurazione, segreti e autenticazione in Maxwell

### Variabili d’ambiente “di prodotto” e controllo accessi

Maxwell usa diverse variabili per definire sicurezza e comportamento:

- `AI_SUPPORT_ALLOWED_ORIGINS`: lista CORS (comma-separated). Se include `*`, Maxwell permette qualsiasi origin. Se la lista è specifica, Maxwell riflette solo origin presenti nella allowlist.
- `AI_SUPPORT_API_KEY`: (opzionale) abilita protezione della chat API; se impostata, `/api/ai/chat` richiede token (header o Bearer).
- `AI_SUPPORT_API_TOKEN` / `AI_SUPPORT_ISSUE_TOKEN`: token richiesto specificamente per `/api/ai/issue`.
- `AI_SUPPORT_ADMIN_ENABLED`: abilita o disabilita gli endpoint admin `/auth` e `/auth/command`.
- Rate limit configurabile con `AI_SUPPORT_RATE_LIMIT_MAX` e `AI_SUPPORT_RATE_LIMIT_WINDOW_MS`, con default 60 req/minuto per chiave, dove la chiave è preferibilmente “token” e altrimenti IP.

Dal punto di vista della “politica CORS”, Maxwell applica CORS alle rotte in base ai `allowedOrigins`, ma fa un’eccezione pragmatica: se l’origin non è consentito, `GET /health` viene comunque reso leggibile da probe esterni impostando `Access-Control-Allow-Origin: *`. Questo è molto orientato alla vita reale (monitoring) e coerente con servizi su hosting managed.

### Strategia credenziali: file JSON ignorato + directory auth

La repo evidenzia (anche indirettamente) la presenza di credenziali locali:

- `.gitignore` ignora esplicitamente `maxwell-ai-credentials.json`, quindi il repository si aspetta un file credenziali locale/non versionato per Maxwell.
- `tools/ai-support-server.js` cerca credenziali in diversi path possibili nel repo root (`maxwell-ai-credentials.json`, varianti con `@`), oppure in directory tipiche di secret file mounts quando rileva un ambiente Render (include `/etc/secrets`, `/run/secrets`, ecc., e anche env come `RENDER_SECRET_FILES_DIR` se presenti).
- Maxwell può costruire directory “runtime” dove tenere configurazioni CLI isolate (`codex` e `github`), e può anche usare un `AI_SUPPORT_AUTH_DIR` persistente e un env file (`AI_SUPPORT_AUTH_ENV_FILE`) per ricordarsi dove sono state salvate.

Questa strategia si allinea bene con la doc ufficiale di Codex CLI: Codex conserva login localmente in `~/.codex/auth.json` (plaintext file) o cred store; e su headless consiglia device-code auth. citeturn2search3  
Sul lato GitHub CLI, la doc chiarisce che `gh` memorizza token in credential store o, in mancanza, può cadere su file plaintext; e che l’ambiente (`GH_TOKEN`) è una modalità consigliata per headless/automation. citeturn2search5

## Osservazioni di copertura e cosa non è stato possibile ricostruire qui

Maxwell è stato ricostruito in modo molto dettagliato perché il suo file centrale (`tools/ai-support-server.js`) e la sua topologia di deploy (`render.yaml`) sono risultati leggibili e consentono di dedurre: routing, auth, CORS, rate limiting, device login, fallback REST, keep-alive e watchdog.

La ricostruzione dell’**intero repository**, invece, in questa sessione è rimasta parziale perché non sono risultati leggibili diversi file chiave che normalmente completano la scheda tecnica (in particolare: `package.json` per elencare script/dipendenze, workflow GitHub Actions per CI/CD e automazioni, e diversi file sotto `apps/` per descrivere con precisione l’integrazione frontend → Maxwell). Di conseguenza, la scheda “repo” qui sopra è affidabile sui macro-concetti (struttura, deploy, presenza dei moduli), ma non può includere una mappatura completa delle dipendenze NPM e delle pipeline CI/CD senza inventare.