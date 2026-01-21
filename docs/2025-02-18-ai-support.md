# 2025-02-18 - AI Support (Maxwell) Setup

## Changelog

- Added prompt template and CLI workflow placeholders.
- Documented backend endpoint plan and GitHub issue helper usage.
- Captured manual verification steps for the end-to-end flow.
- Documented the local AI support server used by mobile.

## Obiettivo

Definire un flusso per generare prompt consistenti, invocare Codex da CLI o backend, e aprire issue GitHub dal risultato.

## Prompt template

Template file:

- `apps/pwa/src/features/ai/prompt-template.md`

Placeholder previsti:

- `{{repo_name}}`, `{{current_branch}}`, `{{repo_overview}}`
- `{{issue_title}}`, `{{issue_body}}`, `{{user_request}}`, `{{target_flow}}`
- `{{relevant_files}}`, `{{acceptance_criteria}}`, `{{constraints}}`, `{{additional_context}}`

## CLI Codex

Script:

- `npm run ai:codex`

Variabili d'ambiente usate dal renderer:

- `AI_PROMPT_TEMPLATE` (opzionale, path template)
- `AI_REPO_NAME`
- `AI_BRANCH`
- `AI_REPO_OVERVIEW`
- `AI_ISSUE_TITLE`
- `AI_ISSUE_BODY`
- `AI_USER_REQUEST`
- `AI_TARGET_FLOW`
- `AI_RELEVANT_FILES`
- `AI_ACCEPTANCE_CRITERIA`
- `AI_CONSTRAINTS`
- `AI_ADDITIONAL_CONTEXT`

Variabili d'ambiente per eseguire Codex:

- `CODEX_BIN` (opzionale, default `codex`)
- `CODEX_ARGS` (opzionale, argomenti extra per la CLI)

Esempio:

```sh
AI_REPO_NAME="Turni-di-Palco" \
AI_BRANCH="work" \
AI_USER_REQUEST="Preparare un prompt completo per l'assistente" \
npm run ai:codex
```

Per stampare il prompt senza invocare Codex:

```node
node tools/ai-codex.js --print
```

## Collegamento template a UI/servizio

Nel frontend e' disponibile un service che costruisce il prompt e lo invia a un endpoint:

- `apps/pwa/src/services/ai.ts`

Endpoint previsto:

- `POST /api/ai/chat`

Payload suggerito:

```JSON
{
  "prompt": "<template compilato>",
  "messages": [{ "role": "user", "content": "..." }],
  "context": { "repoName": "..." }
}
```

Se il backend non esiste, creare un handler che:

1. Riceve il template compilato.
2. Inoltra la richiesta a Codex.
3. Restituisce la risposta al frontend.

## Supporto in app (mobile)

- La schermata "Supporto" in `apps/mobile` usa `POST /api/ai/chat` e un prompt dedicato all'utente finale (linguaggio semplice, niente dettagli tecnici).
- Nome assistente in app: Maxwell (tono super disponibile e informale).
- Maxwell sa che lo sviluppatore e' Federico e usa frasi umane tipo "Lo segnalo a Federico".
- Avvio locale separato: `npm --prefix apps/mobile run dev` e `npm run ai:support`.
- Avvio combinato: `npm --prefix apps/mobile run dev:with-ai`.
- Il dev server mobile fa proxy `/api/ai/chat` verso `http://localhost:${VITE_AI_SUPPORT_PORT}` (fallback `AI_SUPPORT_PORT`).
- Per cambiare la porta locale, impostare `VITE_AI_SUPPORT_PORT` (client/proxy) e, se necessario, `AI_SUPPORT_PORT` per il server.
- Per un endpoint remoto, impostare `VITE_AI_SUPPORT_ENDPOINT` in `apps/mobile/.env`.
- Se `VITE_AI_SUPPORT_ENDPOINT` non e' valorizzato, l'app usa l'host corrente e la porta `8787`.
- Per la creazione issue, l'assistente aggiunge in coda `ISSUE_DRAFT:{...}` con i label `supporto` e `Maxwell`. La UI lo rimuove dal testo e invia `POST /api/ai/issue` in autonomia.
- Endpoint issue remoto: `VITE_AI_SUPPORT_ISSUE_ENDPOINT` (default derivato da `VITE_AI_SUPPORT_ENDPOINT`).
- Il server prova a trovare una issue con lo stesso titolo: se esiste, commenta quella invece di crearne una nuova.
- I label "supporto" e "Maxwell" vengono aggiunti automaticamente (se non esistono, il server prova a crearli).
- Se il client chiama un endpoint assoluto, configurare `AI_SUPPORT_ALLOWED_ORIGINS` sul server (comma-separated).
- HTTPS locale: impostare `AI_SUPPORT_HTTPS=1` e usare certificati da `.cert/` oppure `SSL_CRT_FILE`/`SSL_KEY_FILE`.
- Il server AI ascolta su tutti gli IP (`AI_SUPPORT_HOST=0.0.0.0` di default).
- Log colorati: disabilitabili con `AI_SUPPORT_COLOR=0`.
- Memoria utente: la chat conserva le conversazioni per utente e usa una sintesi delle sessioni precedenti.
- Cronologia chat: accessibile dal pulsante "Cronologia chat" nella schermata Supporto.

## Creazione issue (gh CLI)

- Endpoint locale: `POST /api/ai/issue` (server `tools/ai-support-server.js`).
- Usa GitHub CLI (`gh issue create`) e quindi richiede `gh auth login` gia' configurato.
- Variabili opzionali:
  - `AI_SUPPORT_GH_REPO` (es. `Heartran/Turni-di-Palco`)
  - `AI_SUPPORT_GH_BIN` (override path del binario `gh`)
  - `GITHUB_REPO_OWNER` + `GITHUB_REPO_NAME` (fallback repo)

## Gestione credenziali GitHub

Token e repo devono vivere lato server (mai nel browser) e vanno passati a `createGithubIssue` (es. da env):

- `GITHUB_TOKEN`
- `GITHUB_REPO_OWNER`
- `GITHUB_REPO_NAME`
- `GITHUB_API_URL` (opzionale, default `https://api.github.com`)

Helper disponibile:

- `apps/pwa/src/lib/githubIssue.ts`

## Verifica manuale (end-to-end)

1. Eseguire `npm run ai:codex` con variabili d'ambiente compilate.
2. Inviare il prompt al backend `/api/ai/chat` e ottenere una risposta.
3. Validare la risposta (completezza, tono, rispetto template).
4. Usare `POST /api/ai/issue` o il modulo `createGithubIssue` dal backend per aprire una issue.
5. Annotare limiti emersi (token mancanti, rate limit, prompt troppo lungo).
