
# Mobile UI for Turni di Palco

Code bundle for the Turni di Palco mobile experience.

## Running the code

- Run `npm i` to install the dependencies.
- Run `npm run dev` to start the development server.

## Authentication and state persistence

- The login view only edits the profile email; there is no backend authentication and no password handling.
- All gameplay and profile data are stored locally in the browser under the `tdp-mobile-ui-state` key via `window.localStorage` (see `src/state/store.tsx`).
  