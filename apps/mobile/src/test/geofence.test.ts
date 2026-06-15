import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GEOFENCE_RADIUS_M,
  EARTH_RADIUS_M,
  MAX_GEOFENCE_RADIUS_M,
  evaluateGeofence,
  haversineDistanceM,
  isValidLatitude,
  isValidLongitude,
  resolveGeofenceRadiusM,
} from '../../../../shared/config/geofence';

// Spazio Rossellini — the seed theatre from
// supabase/migrations/20260310193000_import_spazio_rossellini_theatre.sql
const THEATRE = { latitude: 41.856225, longitude: 12.468561, radiusM: 200 } as const;

// Metres → degrees of latitude (a pure-latitude offset has an exact Haversine
// distance, so this lets us place a check-in at a precise distance for the
// boundary edge cases #322 asks to cover).
const metresToLatDegrees = (m: number): number => m / (EARTH_RADIUS_M * (Math.PI / 180));

describe('geofence — coordinate validation', () => {
  it('accepts in-range latitudes and longitudes (incl. the poles/antimeridian)', () => {
    expect(isValidLatitude(0)).toBe(true);
    expect(isValidLatitude(90)).toBe(true);
    expect(isValidLatitude(-90)).toBe(true);
    expect(isValidLongitude(180)).toBe(true);
    expect(isValidLongitude(-180)).toBe(true);
  });

  it('rejects out-of-range and non-finite coordinates', () => {
    expect(isValidLatitude(90.0001)).toBe(false);
    expect(isValidLatitude(-91)).toBe(false);
    expect(isValidLatitude(Number.NaN)).toBe(false);
    expect(isValidLatitude(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isValidLongitude(180.5)).toBe(false);
    expect(isValidLongitude(-181)).toBe(false);
    expect(isValidLongitude(Number.NaN)).toBe(false);
  });
});

describe('geofence — haversineDistanceM', () => {
  it('is zero for identical points', () => {
    expect(haversineDistanceM(41.9, 12.5, 41.9, 12.5)).toBe(0);
  });

  it('matches a known pure-latitude offset exactly', () => {
    const distance = haversineDistanceM(0, 0, metresToLatDegrees(200), 0);
    expect(distance).toBeCloseTo(200, 6);
  });

  it('is symmetric (A→B equals B→A)', () => {
    const ab = haversineDistanceM(41.9, 12.5, 45.07, 7.69);
    const ba = haversineDistanceM(45.07, 7.69, 41.9, 12.5);
    expect(ab).toBeCloseTo(ba, 9);
  });

  it('returns NaN when any input is not finite', () => {
    expect(haversineDistanceM(Number.NaN, 0, 0, 0)).toBeNaN();
    expect(haversineDistanceM(0, 0, 0, Number.POSITIVE_INFINITY)).toBeNaN();
  });
});

describe('geofence — resolveGeofenceRadiusM', () => {
  it('falls back to the default for unset / invalid radii', () => {
    expect(resolveGeofenceRadiusM(null)).toBe(DEFAULT_GEOFENCE_RADIUS_M);
    expect(resolveGeofenceRadiusM(undefined)).toBe(DEFAULT_GEOFENCE_RADIUS_M);
    expect(resolveGeofenceRadiusM(Number.NaN)).toBe(DEFAULT_GEOFENCE_RADIUS_M);
    expect(resolveGeofenceRadiusM(0)).toBe(DEFAULT_GEOFENCE_RADIUS_M);
    expect(resolveGeofenceRadiusM(-50)).toBe(DEFAULT_GEOFENCE_RADIUS_M);
  });

  it('keeps a valid radius and clamps above the maximum', () => {
    expect(resolveGeofenceRadiusM(200)).toBe(200);
    expect(resolveGeofenceRadiusM(MAX_GEOFENCE_RADIUS_M + 1)).toBe(MAX_GEOFENCE_RADIUS_M);
  });
});

describe('geofence — evaluateGeofence (mirrors the server RPC decision)', () => {
  it('validates a check-in at the theatre itself', () => {
    const result = evaluateGeofence(
      { latitude: THEATRE.latitude, longitude: THEATRE.longitude },
      THEATRE,
    );
    expect(result.status).toBe('validated');
  });

  it('treats the exact boundary as inside (inclusive <=)', () => {
    const checkin = {
      latitude: THEATRE.latitude + metresToLatDegrees(THEATRE.radiusM),
      longitude: THEATRE.longitude,
    };
    const result = evaluateGeofence(checkin, THEATRE);
    expect(result.status).toBe('validated');
    if (result.status === 'validated') {
      expect(result.distanceM).toBeCloseTo(THEATRE.radiusM, 3);
      expect(result.radiusM).toBe(THEATRE.radiusM);
    }
  });

  it('validates just inside and rejects just outside the radius', () => {
    const justInside = evaluateGeofence(
      {
        latitude: THEATRE.latitude + metresToLatDegrees(THEATRE.radiusM - 1),
        longitude: THEATRE.longitude,
      },
      THEATRE,
    );
    expect(justInside.status).toBe('validated');

    const justOutside = evaluateGeofence(
      {
        latitude: THEATRE.latitude + metresToLatDegrees(THEATRE.radiusM + 1),
        longitude: THEATRE.longitude,
      },
      THEATRE,
    );
    expect(justOutside.status).toBe('outside_geofence');
    if (justOutside.status === 'outside_geofence') {
      expect(justOutside.errorCode).toBe('outside_geofence');
      expect(justOutside.distanceM).toBeGreaterThan(justOutside.radiusM);
    }
  });

  it('uses the 100m default radius when the theatre has none configured', () => {
    const base = { latitude: THEATRE.latitude, longitude: THEATRE.longitude };
    const at150m = {
      latitude: THEATRE.latitude + metresToLatDegrees(150),
      longitude: THEATRE.longitude,
    };
    // 150m is outside the 100m default but would be inside the 200m configured radius.
    expect(evaluateGeofence(at150m, base).status).toBe('outside_geofence');
    expect(evaluateGeofence(at150m, { ...base, radiusM: 200 }).status).toBe('validated');
  });

  it('flags invalid check-in latitude and longitude before computing distance', () => {
    expect(evaluateGeofence({ latitude: 91, longitude: 12 }, THEATRE).status).toBe(
      'invalid_checkin_latitude',
    );
    expect(evaluateGeofence({ latitude: 41, longitude: 181 }, THEATRE).status).toBe(
      'invalid_checkin_longitude',
    );
    expect(evaluateGeofence({ latitude: Number.NaN, longitude: 12 }, THEATRE).status).toBe(
      'invalid_checkin_latitude',
    );
  });

  it('reports a not-configured theatre when coordinates are missing', () => {
    const result = evaluateGeofence(
      { latitude: 41.9, longitude: 12.5 },
      { latitude: null, longitude: null },
    );
    expect(result.status).toBe('theatre_geofence_not_configured');
  });
});
