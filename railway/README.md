# Railway service configs (derived from `render.yaml`)

This folder mirrors the 4 services declared in `render.yaml` and provides one Railway Config-as-Code JSON file per service.

## Service -> config file mapping

1. `Turni-di-Palco` -> `railway/turni-di-palco.railway.json`
2. `Maxwell-AI-Support` -> `railway/maxwell-ai-support.railway.json`
3. `Turni-di-Palco-Control-Plane` -> `railway/turni-di-palco-control-plane.railway.json`
4. `Turni-di-Palco-Badges` -> `railway/turni-di-palco-badges.railway.json`

## Notes about parity with Render

- Commands are translated from `render.yaml`.
- For `Turni-di-Palco` and `Turni-di-Palco-Control-Plane`, the duplicate `npm ci` in `buildCommand` was intentionally removed because Railway already runs install (`npm ci`) in its install step. Keeping both causes the observed `EBUSY` failure on `apps/*/node_modules/.vite`.
- Regions and PR preview generation mode are managed in Railway project/service settings.

## Environment variables to configure per service

### Turni-di-Palco
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_URL`
- `VITE_DEV_CONTROL_PLANE_URL`

### Maxwell-AI-Support
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_URL`
- `AI_SUPPORT_ALLOWED_ORIGINS`

### Turni-di-Palco-Control-Plane
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RENDER_API_KEY`
- `RENDER_SERVICE_IDS_JSON`
- `CONTROL_PLANE_ALLOWED_ORIGINS`
- `CONTROL_PLANE_ALLOWED_EMAILS`
- `CONTROL_PLANE_RATE_LIMIT_PER_MIN`
- `CONTROL_PLANE_CONFIRM_TTL_MS`

### Turni-di-Palco-Badges
- `GH_TOKEN`
