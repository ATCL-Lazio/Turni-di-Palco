
# Mobile UI for Turni di Palco

Code bundle for the Turni di Palco mobile experience.

## Running the code

- Run `npm i` to install the dependencies.
- Run `npm run dev` to start the development server.

## iOS test build (Capacitor)

- Run `npm run ios:add` once to scaffold `ios/`.
- Run `npm run ios:sync` after each web change to rebuild and copy assets.
- Run `npm run ios:open` to open the Xcode workspace (macOS only).
- The iOS 26 visual layer is enabled only on native iOS runtime (`Capacitor` platform `ios`) via `ios26-ui` classes.

## iOS cloud build to TestFlight (no local Mac)

- Workflow: `.github/workflows/ios-testflight.yml` (manual trigger).
- Required repository variables:
  - `APPSTORE_ISSUER_ID`
  - `APPSTORE_API_KEY_ID`
  - `IOS_TEAM_ID`
  - `IOS_BUNDLE_ID` (optional, defaults to `com.turnidipalco.mobile`)
- Required repository secrets:
  - `APPSTORE_API_PRIVATE_KEY` (full `.p8` content)
  - `IOS_DISTRIBUTION_CERT_P12_BASE64` (base64 of distribution `.p12`)
  - `IOS_DISTRIBUTION_CERT_PASSWORD` (password used for the `.p12`)
- Trigger from GitHub: `Actions` → `iOS TestFlight` → `Run workflow`.
- The workflow builds `apps/mobile`, archives `apps/mobile/ios/App/App.xcodeproj`, exports `.ipa`, uploads an artifact, then sends it to TestFlight.

## Authentication and state persistence

- The login view only edits the profile email; when Supabase is configured it uses Supabase Auth for sign-up/sign-in.
- All gameplay and profile data are stored locally in the browser under the `tdp-mobile-ui-state` key via `window.localStorage` (see `src/state/store.tsx`).
  

## Events feed and follow
- The events list can be pulled from Supabase; Home shows followed events, while Turni ATCL shows the full catalog with follow/unfollow.
- Followed events are stored in `followed_events` and refreshed via realtime subscriptions.

## Event details
- The event detail screen can export a local `.ics` calendar file using `event_date` + `event_time` from the feed.
- Navigation uses the platform default maps app: `maps://` on iOS, `geo:` on Android, and Google Maps web on desktop.
