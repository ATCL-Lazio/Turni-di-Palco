# 2025-02-18 - AI Support (Codex) Setup

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
```
AI_REPO_NAME="Turni-di-Palco" \
AI_BRANCH="work" \
AI_USER_REQUEST="Preparare un prompt completo per l'assistente" \
npm run ai:codex
```

Per stampare il prompt senza invocare Codex:
```
node tools/ai-codex.js --print
```

## Collegamento template a UI/servizio
Nel frontend e' disponibile un service che costruisce il prompt e lo invia a un endpoint:
- `apps/pwa/src/services/ai.ts`

Endpoint previsto:
- `POST /api/ai/chat`

Payload suggerito:
```
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
- Avvio locale separato: `npm --prefix apps/mobile run dev` e `npm run ai:support`.
- Avvio combinato: `npm --prefix apps/mobile run dev:with-ai`.
- Il dev server mobile fa proxy `/api/ai/chat` verso `http://localhost:${AI_SUPPORT_PORT}`.
- Per un endpoint remoto, impostare `VITE_AI_SUPPORT_ENDPOINT` in `apps/mobile/.env`.
 - Se il client chiama un endpoint assoluto, configurare `AI_SUPPORT_ALLOWED_ORIGINS` sul server (comma-separated).

## Gestione credenziali GitHub
Token e repo devono vivere lato server (mai nel browser):
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
4. Usare il modulo `createGithubIssue` dal backend per aprire una issue.
5. Annotare limiti emersi (token mancanti, rate limit, prompt troppo lungo).
