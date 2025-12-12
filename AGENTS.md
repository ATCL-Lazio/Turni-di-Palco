# Repository Guidelines

## Project Structure & Module Organization
- `src/`: TypeScript app shell (`main.ts` bootstraps UI, `pwa/register-sw.ts` handles service worker lifecycle, `style.css` houses styles). Add gameplay modules and UI here.
- `public/`: Static assets copied as-is (`manifest.webmanifest`, `sw.js`, icons in `public/icons/`). Keep large binaries compressed and versioned; prefer linking to external storage for raw sources.
- `docs and references/`: Existing PDFs for design/GDD. Add new docs with dated filenames (e.g., `2025-01-design-notes.pdf`) and a brief header changelog.
- `index.html`: Entry HTML with manifest links and theme color. Update only when adding new meta tags or entry points.

## Build, Test, and Development Commands
- Install deps: `npm install` (Node 18+; repo currently uses Node 22.14.0).
- Dev server: `npm run dev` (Vite, default http://localhost:5173, exposes on host for device testing).
- Production build: `npm run build` → outputs to `dist/`.
- Preview built app: `npm run preview`.
- Tests: `npm test` (Vitest; setup file at `src/test/setup.ts`, add specs as they appear).
- Keep lockfiles committed. Prefer deterministic scripts (fixed seeds, headless-friendly).

## Coding Style & Naming Conventions
- Default to 2-space indentation in TS/JS/CSS, UTF-8 text, and trailing newlines. Use PascalCase for types/classes, camelCase for variables/functions, kebab-case for asset filenames, and snake_case for data/config files.
- Add lint/format tooling per stack (ESLint/Prettier for JS/TS, EditorConfig for mixed languages) and run before commits. Keep design docs concise and date-stamped inside the document.

## Testing Guidelines
- Place specs under `src/` (e.g., `src/<feature>.spec.ts`). Keep runs deterministic; avoid real network or filesystem calls.
- Aim for fast unit coverage on gameplay logic and smoke tests on critical flows. Document manual verification steps for interactive features.
- If adding integration/UI tests, ensure they are headless-friendly for CI.

## Commit & Pull Request Guidelines
- Use short, imperative commit messages (e.g., `Add dialogue parser`, `Fix scene load order`). Keep changes scoped and commit frequently.
- PRs should include intent, key changes, and testing performed; link related tasks/issues. Add screenshots or short clips for visual changes.
- Before opening a PR, ensure docs are updated, new commands are documented, and tests (if any) pass locally.
- All commits should be done using **your own git identity**
- You should always commits submodules **before** the main repository

## Identity & Git Hygiene
- Author/committer identity is managed by the repo owner; do not change git config locally (no `git config` commands). Use the existing configuration as-is.
- Keep commits small and topical; prefer multiple commits over one large drop when touching orthogonal areas.

## PWA & Assets
- Update `public/sw.js` cache version string when altering core assets to ensure clients receive the new shell.
- Keep manifest (`public/manifest.webmanifest`) in sync with icon filenames and theme colors. Replace placeholder icons in `public/icons/` with final branding once available.

## Work Plan
- Piano MVP in `docs and references/plan.md`. Mantienilo aggiornato a ogni milestone/modifica rilevante (scope, priorità, stato attività).

## Git Identity
- Every agent should have his own git identity when committing changes in order to have a more clear and readable history

| Agent | GIT_COMMITTER_NAME / GIT_AUTHOR_NAME | GIT_COMMITTER_EMAIL / GIT_AUTHOR_EMAIL |
|-------|:--------------------------------------:|----------------------------------------|
| Codex | Codex                                | codex@users.noreply.github.com         |
| Gemini | Gemini | gemini-code-assist@users.noreply.github.com |