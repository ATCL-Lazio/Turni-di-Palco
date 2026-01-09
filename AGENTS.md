# Repository Guidelines

## Project Structure & Module Organization

- `apps/pwa`: Vite PWA multipage (`src/` TypeScript shell, `public/` static assets incl. `public/mobile/`, `public/sw.js`, manifest/icons; HTML entry points in package root).

- `UI` (submodule): Mobile UI React/Vite source; build output va copiato in `apps/pwa/public/mobile/`.

- `reactbricks`: CMS sources (da ripulire; integrare come workspace separato).

- `docs and references/`: PDF di design/GDD; aggiungi nuovi file datati con changelog breve.

## Build, Test, and Development Commands

- Install deps (workspaces per PWA): `npm install` (Node 18+; repo attuale Node 22.14.0).

- PWA: `npm run dev:pwa` / `npm run dev:pwa:https`, build `npm run build:pwa`, preview `npm run preview:pwa`, test `npm run test:pwa` (setup in `apps/pwa/src/test/setup.ts`).

- Mobile UI (submodule `UI`): `npm --prefix UI run dev|build`; `npm run build:mobile` esegue build+copy in `apps/pwa/public/mobile/` (solo copia: `npm run sync:mobile`).

- Keep lockfiles committed. Prefer deterministic scripts (fixed seeds, headless-friendly).

## Coding Style & Naming Conventions

- Default to 2-space indentation in TS/JS/CSS, UTF-8 text, and trailing newlines. Use PascalCase for types/classes, camelCase for variables/functions, kebab-case for asset filenames, and snake_case for data/config files.

- Add lint/format tooling per stack (ESLint/Prettier for JS/TS, EditorConfig for mixed languages) and run before commits. Keep design docs concise and date-stamped inside the document.

## Testing Guidelines

- Place specs under `apps/pwa/src/` (e.g., `src/<feature>.spec.ts`). Keep runs deterministic; avoid real network or filesystem calls.

- Aim for fast unit coverage on gameplay logic and smoke tests on critical flows. Document manual verification steps for interactive features.

- If adding integration/UI tests, ensure they are headless-friendly for CI.

## Commit & Pull Request Guidelines

- Use short, imperative commit messages (e.g., `Add dialogue parser`, `Fix scene load order`). Keep changes scoped and commit frequently.

- PRs should include intent, key changes, and testing performed; link related tasks/issues. Add screenshots or short clips for visual changes.

- Before opening a PR, ensure docs are updated, new commands are documented, and tests (if any) pass locally.

- All commits should be done using **your own git identity**

- Do not work directly on `main`: create a dedicated branch for any change before committing or pushing.

- You should always commits submodules **before** the main repository

## Identity & Git Hygiene

- Author/committer identity is managed by the repo owner; do not change git config locally (no `git config` commands). Use the existing configuration as-is.

- Never use the Heartran git identity for commits or pushes.

- Keep commits small and topical; prefer multiple commits over one large drop when touching orthogonal areas.

## PWA & Assets

- Update `apps/pwa/public/sw.js` cache version string (o automatizza) quando alteri asset core per forzare l’update.

- Tieni manifest (`apps/pwa/public/manifest.webmanifest`) in sync con icone e theme color. Placeholder in `apps/pwa/public/icons/`.

## Work Plan

- Piano MVP in `docs and references/plan.md`. Mantienilo aggiornato a ogni milestone/modifica rilevante (scope, priorità, stato attività).

## Git Identity

- Every agent should have his own git identity when committing changes in order to have a more clear and readable history

| Agent | GIT_COMMITTER_NAME / GIT_AUTHOR_NAME | GIT_COMMITTER_EMAIL / GIT_AUTHOR_EMAIL |
| --- | :---: | --- |
| Codex | Codex | [codex@users.noreply.github.com](mailto:codex@users.noreply.github.com) |
| Gemini | Gemini | [gemini-code-assist@users.noreply.github.com](mailto:gemini-code-assist@users.noreply.github.com) |
| Cascade | Cascade | [cascade@users.noreply.github.com](mailto:cascade@users.noreply.github.com) |
| GitHub Copilot | GitHub Copilot | [github-copilot@users.noreply.github.com](mailto:github-copilot@users.noreply.github.com) |
