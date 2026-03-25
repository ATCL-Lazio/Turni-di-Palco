# Repository Guidelines

Template developed by [Heartran](https://github.com/heartran)

## Project Structure & Module Organization

- `apps/pwa`: Vite PWA multipage (`src/` TypeScript shell, `public/` static assets incl. `public/mobile/`, `public/sw.js`, manifest/icons; HTML entry points in package root).

- `apps/mobile`: App mobile React/Vite.

- `apps/reactbricks`: CMS sources (da ripulire; integrare come workspace separato).

- `docs/`: PDF di design/GDD.
  - **Non creare nuovi documenti o file in `docs/` se non esplicitamente richiesti.** Si preferiscono **sempre** le modifiche fatte su branch diversi da `main`.

## Build, Test, and Development Commands

- Install deps (workspaces per PWA): `npm install` (Node 18+; repo attuale Node 22.14.0).

- PWA: `npm run dev:pwa` / `npm run dev:pwa:https`, build `npm run build:pwa`, preview `npm run preview:pwa`, test `npm run test:pwa` (setup in `apps/pwa/src/test/setup.ts`).

- Mobile (`apps/mobile`): `npm run dev:mobile`, `npm run build:mobile`, `npm run sync:mobile`.

- Keep lockfiles committed. Prefer deterministic scripts (fixed seeds, headless-friendly).

## Coding Style & Naming Conventions

- Default to 2-space indentation in TS/JS/CSS, UTF-8 text, and trailing newlines. Use PascalCase for types/classes, camelCase for variables/functions, kebab-case for asset filenames, and snake_case for data/config files.

- Add lint/format tooling per stack (ESLint/Prettier for JS/TS, EditorConfig for mixed languages) and run before commits. Keep design docs concise and date-stamped inside the document.

## Testing Guidelines

- Place specs under `apps/pwa/src/` (e.g., `src/<feature>.spec.ts`). Keep runs deterministic; avoid real network or filesystem calls.

- Aim for fast unit coverage on gameplay logic and smoke tests on critical flows. Document manual verification steps for interactive features.

- If adding integration tests for the interface, ensure they are headless-friendly for CI.

## Commit & Pull Request Guidelines

- Use short, imperative commit messages (e.g., `Add dialogue parser`, `Fix scene load order`). Keep changes scoped and commit frequently.

- PRs should include intent, key changes, and testing performed; link related tasks/issues. Add screenshots or short clips for visual changes.

- Before opening a PR, ensure docs are updated, new commands are documented, and tests (if any) pass locally.

- All commits should be done using **your own git identity**

- Do not work directly on `main`, `render/preview` or `railway/preview`: create a dedicated branch with setup prefix before committing or pushing.
  - Examples: `windsurf/feature-name`, `codex/fix-description`, `gemini/refactor-module`

- Never delete branches (no `--delete-branch` on merges) unless explicitly instructed.


- **Merge policy (MANDATORY for all agents): unless explicitly specified otherwise by the user, the merge target is ALWAYS `main`.**
  - If the target branch is not written clearly in the request, assume `main`.
  - Do not infer a different merge target from recent context/history.

## Identity & Git Hygiene

- Author/committer identity is managed by the repo owner; do not change git config locally (no `git config` commands). Use the existing configuration as-is. Use $ENV variables for agent-specific commits.

- Never use the Heartran git identity for commits or pushes.

- Keep commits small and topical; prefer multiple commits over one large drop when touching orthogonal areas.

## PWA & Assets

- Update `apps/pwa/public/sw.js` cache version string (o automatizza) quando alteri asset core per forzare l'update.

- Tieni manifest (`apps/pwa/public/manifest.webmanifest`) in sync con icone e theme color. Placeholder in `apps/pwa/public/icons/`.

## Railway Deploy Semantics

- Railway auto-deploy da Git puo mostrare eventi `REMOVED` in history (dedupe/cancel/queue). `REMOVED` non equivale a rollout completato e non sostituisce automaticamente il deployment attivo.

- Per controllo deterministico, considerare valido solo un servizio con `status: SUCCESS` e `deploymentId` attivo da `railway service status --json`.

- Non assumere mai che "ultimo commit visibile in history" sia la versione in esecuzione: verificare sempre il deployment attivo per singolo servizio.

## Git Identity

- Every agent should have his own git identity when committing changes in order to have a more clear and readable history

| Agent | GIT_COMMITTER_NAME / GIT_AUTHOR_NAME | GIT_COMMITTER_EMAIL / GIT_AUTHOR_EMAIL |
| --- | :---: | --- |
| Claude | Claude | [noreply@anthropic.com](mailto:noreply@anthropic.com) |
| Codex | Codex | [199175422+chatgpt-codex-connector[bot]@users.noreply.github.com](mailto:199175422+chatgpt-codex-connector[bot]@users.noreply.github.com) |
| Gemini | Gemini | [176961590+gemini-code-assist[bot]@users.noreply.github.com](mailto:176961590+gemini-code-assist[bot]@users.noreply.github.com) |
| Cascade | Cascade | [cascade@users.noreply.github.com](mailto:cascade@users.noreply.github.com) |
| GitHub Copilot | Copilot[bot] | [198982749+Copilot[bot]@users.noreply.github.com](mailto:198982749+Copilot[bot]@users.noreply.github.com) |

## Dati di accesso frontend

Qualora sia necessario entrare all'interno del sito web i dati di accesso sono:
- Email: `noreply@anthropic.com`
- Password: `Codex`