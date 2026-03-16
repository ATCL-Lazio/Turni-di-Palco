
# Mobile app for Turni di Palco

## Running the code

- Run `npm i` to install the dependencies.
- Run `npm run dev` to start the development server.

## Authentication and state persistence

- The login view only edits the profile email; when Supabase is configured it uses Supabase Auth for sign-up/sign-in.
- All gameplay and profile data are stored locally in the browser under the `tdp-mobile-ui-state` key via `window.localStorage` (see `src/state/store.tsx`).
  

## Events feed and follow
- The events list can be pulled from Supabase; Home shows planned events, while Turni ATCL shows the full catalog with follow/unfollow.
- Event planning is stored in `planned_participations` and refreshed via realtime subscriptions.

## Event details
- The event detail screen can export a local `.ics` calendar file using `event_date` + `event_time` from the feed.
- Navigation uses the platform default maps app: `maps://` on iOS, `geo:` on Android, and Google Maps web on desktop.
