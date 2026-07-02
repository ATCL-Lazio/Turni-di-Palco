-- Popola public.theatres con i 25 teatri reali del circuito ATCL Lazio +
-- coordinate reali (OpenStreetMap Nominatim, verificate) e raggio geofence.
--
-- Prima di questa migrazione la tabella theatres conteneva solo Spazio
-- Rossellini (20260310193000): la registrazione turno con geofence funzionava
-- solo lì. I `name` combaciano ESATTAMENTE con i nomi teatro canonici usati
-- dal gioco (scene narrative, reputazione teatro, profilo pubblico) e con cui
-- register_turn confronta events.theatre (match case-insensitive su name).
--
-- Idempotente: upsert per nome (match case-insensitive). Segue il pattern di
-- rilevamento colonne di 20260310193000 per gestire varianti di schema
-- (name/theatre, latitude/lat, longitude/lng, geofence_radius_m/radius_m).
-- Fonte coordinate: OpenStreetMap (ODbL) — vedi tools/geocode-atcl-theatres.

do $$
declare
  v_name_col    text;
  v_lat_col     text;
  v_lon_col     text;
  v_radius_col  text;
  v_has_updated boolean;
  v_venue       jsonb;
  v_rows        integer;
  v_venues constant jsonb := $seed$[
  {
    "name": "Teatro Francigena",
    "lat": 42.257709,
    "lon": 12.172249,
    "radius": 150
  },
  {
    "name": "Auditorium Leone XIII",
    "lat": 41.60579,
    "lon": 13.08498,
    "radius": 150
  },
  {
    "name": "Cinema Teatro Manzoni",
    "lat": 41.490821,
    "lon": 13.829,
    "radius": 150
  },
  {
    "name": "Teatro Traiano",
    "lat": 42.091563,
    "lon": 11.79344,
    "radius": 120
  },
  {
    "name": "Teatro Vittorio Veneto",
    "lat": 41.734051,
    "lon": 13.009593,
    "radius": 150
  },
  {
    "name": "Teatro Chiesa Vecchia",
    "lat": 41.834302,
    "lon": 12.750305,
    "radius": 160
  },
  {
    "name": "Teatro Potlach",
    "lat": 42.209437,
    "lon": 12.729565,
    "radius": 150
  },
  {
    "name": "Teatro Comunale di Fiuggi",
    "lat": 41.804041,
    "lon": 13.221486,
    "radius": 180
  },
  {
    "name": "Teatro Città di Fondi \"Nino Canale\"",
    "lat": 41.361966,
    "lon": 13.420749,
    "radius": 180
  },
  {
    "name": "Piccolo Teatro Iqbal Masih",
    "lat": 41.258224,
    "lon": 13.610962,
    "radius": 250
  },
  {
    "name": "Spazio Teatro Faber",
    "lat": 41.803641,
    "lon": 12.673173,
    "radius": 150
  },
  {
    "name": "Teatro Comunale Vittoria",
    "lat": 41.638856,
    "lon": 13.35164,
    "radius": 130
  },
  {
    "name": "Teatro Ariston",
    "lat": 41.215129,
    "lon": 13.57,
    "radius": 150
  },
  {
    "name": "Teatro Comunale D'Annunzio",
    "lat": 41.463239,
    "lon": 12.905731,
    "radius": 150
  },
  {
    "name": "Teatro Manlio",
    "lat": 42.361719,
    "lon": 12.480877,
    "radius": 150
  },
  {
    "name": "Teatro Lea Padovani",
    "lat": 42.349737,
    "lon": 11.609655,
    "radius": 150
  },
  {
    "name": "Teatro Comunale F. Ramarini",
    "lat": 42.052834,
    "lon": 12.615561,
    "radius": 150
  },
  {
    "name": "Teatro Comunale Gigi Proietti",
    "lat": 41.472748,
    "lon": 13.180986,
    "radius": 150
  },
  {
    "name": "Teatro Flavio Vespasiano",
    "lat": 42.40313,
    "lon": 12.862561,
    "radius": 150
  },
  {
    "name": "Teatro Paladino",
    "lat": 42.208684,
    "lon": 12.479759,
    "radius": 200
  },
  {
    "name": "Teatro Comunale Rossella Falk",
    "lat": 42.253123,
    "lon": 11.755749,
    "radius": 150
  },
  {
    "name": "Teatro Giuseppetti",
    "lat": 41.961384,
    "lon": 12.800152,
    "radius": 150
  },
  {
    "name": "Teatro Il Rivellino",
    "lat": 42.4165,
    "lon": 11.875601,
    "radius": 130
  },
  {
    "name": "Teatro Artemisio Gian Maria Volonté",
    "lat": 41.687702,
    "lon": 12.777537,
    "radius": 150
  },
  {
    "name": "Teatro dell'Unione",
    "lat": 42.421137,
    "lon": 12.108731,
    "radius": 150
  }
]$seed$::jsonb;
begin
  if to_regclass('public.theatres') is null then
    raise exception 'theatres_table_not_found';
  end if;

  select case
    when exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='theatres' and column_name='name') then 'name'
    when exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='theatres' and column_name='theatre') then 'theatre'
  end into v_name_col;

  select case
    when exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='theatres' and column_name='latitude') then 'latitude'
    when exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='theatres' and column_name='lat') then 'lat'
  end into v_lat_col;

  select case
    when exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='theatres' and column_name='longitude') then 'longitude'
    when exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='theatres' and column_name='lng') then 'lng'
  end into v_lon_col;

  select case
    when exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='theatres' and column_name='geofence_radius_m') then 'geofence_radius_m'
    when exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='theatres' and column_name='radius_m') then 'radius_m'
  end into v_radius_col;

  select exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='theatres' and column_name='updated_at')
  into v_has_updated;

  if v_name_col is null or v_lat_col is null or v_lon_col is null then
    raise exception 'theatres_geodata_columns_missing';
  end if;

  for v_venue in select value from jsonb_array_elements(v_venues) as t(value)
  loop
    if v_radius_col is not null then
      execute format(
        'update public.theatres set %1$I=$2, %2$I=$3, %3$I=$4%5$s
         where lower(trim(%4$I::text)) = lower(trim($1::text))',
        v_lat_col, v_lon_col, v_radius_col, v_name_col,
        case when v_has_updated then ', updated_at = now()' else '' end
      ) using (v_venue->>'name'),
              (v_venue->>'lat')::double precision,
              (v_venue->>'lon')::double precision,
              (v_venue->>'radius')::double precision;
    else
      execute format(
        'update public.theatres set %1$I=$2, %2$I=$3%4$s
         where lower(trim(%3$I::text)) = lower(trim($1::text))',
        v_lat_col, v_lon_col, v_name_col,
        case when v_has_updated then ', updated_at = now()' else '' end
      ) using (v_venue->>'name'),
              (v_venue->>'lat')::double precision,
              (v_venue->>'lon')::double precision;
    end if;

    get diagnostics v_rows = row_count;

    if v_rows = 0 then
      if v_radius_col is not null then
        execute format(
          'insert into public.theatres (%1$I, %2$I, %3$I, %4$I) values ($1, $2, $3, $4)',
          v_name_col, v_lat_col, v_lon_col, v_radius_col
        ) using (v_venue->>'name'),
                (v_venue->>'lat')::double precision,
                (v_venue->>'lon')::double precision,
                (v_venue->>'radius')::double precision;
      else
        execute format(
          'insert into public.theatres (%1$I, %2$I, %3$I) values ($1, $2, $3)',
          v_name_col, v_lat_col, v_lon_col
        ) using (v_venue->>'name'),
                (v_venue->>'lat')::double precision,
                (v_venue->>'lon')::double precision;
      end if;
    end if;
  end loop;
end;
$$;
