-- Geofence documentation (issue #322).
--
-- The geofence backend (theatre coordinates, configurable radius, server-side
-- Haversine distance and the `outside_geofence` rejection) is implemented in
-- 20260310190000_turn_geofence_runtime_config.sql and made optional in
-- 20260325_make_geolocation_optional.sql. This migration only documents the
-- schema so the contract is discoverable from the database itself.
--
-- The decision rule is mirrored, with edge-case tests, by the shared helper
-- shared/config/geofence.ts (apps/mobile/src/test/geofence.test.ts). Keep the
-- two in lockstep: latitude ∈ [-90, 90], longitude ∈ [-180, 180], default
-- radius 100 m, inclusive boundary (inside when distance <= radius).
--
-- Idempotent + defensive: COMMENT statements run only when the column exists,
-- so the migration is safe regardless of which column-name variant a given
-- environment provisioned.

do $$
begin
  if to_regclass('public.theatres') is null then
    raise notice 'public.theatres not found; skipping geofence documentation';
    return;
  end if;

  comment on table public.theatres is
    'Theatre registry with geofence configuration used to validate turn check-ins (issue #322).';

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'theatres' and column_name = 'latitude'
  ) then
    comment on column public.theatres.latitude is
      'Theatre latitude in decimal degrees, range [-90, 90]. Used as the geofence centre for turn check-in validation.';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'theatres' and column_name = 'longitude'
  ) then
    comment on column public.theatres.longitude is
      'Theatre longitude in decimal degrees, range [-180, 180]. Used as the geofence centre for turn check-in validation.';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'theatres' and column_name = 'geofence_radius_m'
  ) then
    comment on column public.theatres.geofence_radius_m is
      'Allowed check-in radius in metres (0 < radius <= 5000). When NULL the RPC falls back to a 100 m default. A check-in is inside the geofence when Haversine distance <= radius.';
  end if;
end
$$;
