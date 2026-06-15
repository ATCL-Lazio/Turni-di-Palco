/**
 * Shared geofence helpers for Turni di Palco — turn registration check-in.
 *
 * Single source of truth for the geofence math so that the client (pre-check,
 * status UI, telemetry) and the server RPC stay in agreement. The numbers and
 * the decision rule below MIRROR the authoritative server implementation in
 * `supabase/migrations/20260325_make_geolocation_optional.sql`
 * (`register_turn_with_token_boost`):
 *
 * - coordinate ranges: latitude ∈ [-90, 90], longitude ∈ [-180, 180];
 * - Haversine distance with Earth radius 6_371_000 m;
 * - default radius 100 m when a theatre has no configured `geofence_radius_m`;
 * - INCLUSIVE boundary: a check-in is inside the geofence when
 *   `distance <= radius` (equality counts as inside).
 *
 * Closes part of issues #322 (backend geofence) / #323 (mobile capture + UX):
 * provides the edge-case-tested geofence logic these issues call for. Keep this
 * file and the SQL RPC in lockstep — if one changes, change the other.
 */

/** Earth mean radius in metres (matches the SQL `6371000`). */
export const EARTH_RADIUS_M = 6_371_000 as const;

/** Fallback radius (metres) used when a theatre has no `geofence_radius_m`. */
export const DEFAULT_GEOFENCE_RADIUS_M = 100 as const;

/**
 * Upper bound for a per-theatre radius, mirroring the CHECK constraint
 * `0 < geofence_radius_m <= 5000` from
 * `supabase/migrations/20260310190000_turn_geofence_runtime_config.sql`.
 */
export const MAX_GEOFENCE_RADIUS_M = 5_000 as const;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** True when `value` is a finite latitude in [-90, 90]. */
export function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

/** True when `value` is a finite longitude in [-180, 180]. */
export function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

/**
 * Great-circle distance in metres between two coordinates (Haversine).
 * Returns `NaN` if any input is not a finite number, so callers can detect
 * bad input instead of acting on a bogus distance.
 */
export function haversineDistanceM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2)
  ) {
    return Number.NaN;
  }
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.asin(Math.sqrt(a));
}

/**
 * Resolve the effective radius for a theatre. Mirrors the server
 * `coalesce(geofence_radius_m, 100)` while defensively treating non-finite or
 * non-positive values as "unset" and clamping above `MAX_GEOFENCE_RADIUS_M`.
 */
export function resolveGeofenceRadiusM(theatreRadiusM?: number | null): number {
  if (theatreRadiusM == null || !Number.isFinite(theatreRadiusM) || theatreRadiusM <= 0) {
    return DEFAULT_GEOFENCE_RADIUS_M;
  }
  return Math.min(theatreRadiusM, MAX_GEOFENCE_RADIUS_M);
}

export type GeofenceCheckin = Readonly<{ latitude: number; longitude: number }>;

export type GeofenceTheatre = Readonly<{
  latitude?: number | null;
  longitude?: number | null;
  radiusM?: number | null;
}>;

/**
 * Result of a geofence evaluation. `errorCode` values match the server tokens
 * surfaced to the user in `apps/mobile/src/state/store.tsx` so the same copy
 * mapping can be reused client-side.
 */
export type GeofenceEvaluation =
  | { status: 'validated'; distanceM: number; radiusM: number }
  | { status: 'outside_geofence'; distanceM: number; radiusM: number; errorCode: 'outside_geofence' }
  | { status: 'invalid_checkin_latitude'; errorCode: 'invalid_checkin_latitude' }
  | { status: 'invalid_checkin_longitude'; errorCode: 'invalid_checkin_longitude' }
  | { status: 'theatre_geofence_not_configured'; errorCode: 'theatre_geofence_not_configured' };

/**
 * Pure mirror of the server geofence decision. Validates the check-in
 * coordinates, resolves the theatre radius, computes the Haversine distance and
 * applies the inclusive boundary rule. When the theatre has no coordinates the
 * server skips the check; here we surface that explicitly so callers can decide
 * (the server treats a missing theatre as "validated/skip").
 */
export function evaluateGeofence(
  checkin: GeofenceCheckin,
  theatre: GeofenceTheatre,
): GeofenceEvaluation {
  if (!isValidLatitude(checkin.latitude)) {
    return { status: 'invalid_checkin_latitude', errorCode: 'invalid_checkin_latitude' };
  }
  if (!isValidLongitude(checkin.longitude)) {
    return { status: 'invalid_checkin_longitude', errorCode: 'invalid_checkin_longitude' };
  }
  if (
    theatre.latitude == null ||
    theatre.longitude == null ||
    !isValidLatitude(theatre.latitude) ||
    !isValidLongitude(theatre.longitude)
  ) {
    return {
      status: 'theatre_geofence_not_configured',
      errorCode: 'theatre_geofence_not_configured',
    };
  }

  const radiusM = resolveGeofenceRadiusM(theatre.radiusM);
  const distanceM = haversineDistanceM(
    checkin.latitude,
    checkin.longitude,
    theatre.latitude,
    theatre.longitude,
  );

  // Inclusive boundary: distance == radius is INSIDE (matches SQL `<=`).
  if (distanceM <= radiusM) {
    return { status: 'validated', distanceM, radiusM };
  }
  return { status: 'outside_geofence', distanceM, radiusM, errorCode: 'outside_geofence' };
}
