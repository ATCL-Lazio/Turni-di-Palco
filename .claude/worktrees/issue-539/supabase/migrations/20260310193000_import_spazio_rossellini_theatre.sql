do $$
declare
  v_name_column text;
  v_lat_column text;
  v_lon_column text;
  v_radius_column text;
  v_has_updated_at boolean;
  v_rows integer := 0;
  v_theatre_name constant text := 'Spazio Rossellini';
  v_latitude constant double precision := 41.856225;
  v_longitude constant double precision := 12.468561;
  v_radius_m constant double precision := 200;
begin
  if to_regclass('public.theatres') is null then
    raise exception 'theatres_table_not_found';
  end if;

  select case
    when exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'theatres'
        and column_name = 'name'
    ) then 'name'
    when exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'theatres'
        and column_name = 'theatre'
    ) then 'theatre'
    else null
  end
  into v_name_column;

  select case
    when exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'theatres'
        and column_name = 'latitude'
    ) then 'latitude'
    when exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'theatres'
        and column_name = 'lat'
    ) then 'lat'
    else null
  end
  into v_lat_column;

  select case
    when exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'theatres'
        and column_name = 'longitude'
    ) then 'longitude'
    when exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'theatres'
        and column_name = 'lng'
    ) then 'lng'
    else null
  end
  into v_lon_column;

  select case
    when exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'theatres'
        and column_name = 'geofence_radius_m'
    ) then 'geofence_radius_m'
    when exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'theatres'
        and column_name = 'radius_m'
    ) then 'radius_m'
    else null
  end
  into v_radius_column;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'theatres'
      and column_name = 'updated_at'
  )
  into v_has_updated_at;

  if v_name_column is null or v_lat_column is null or v_lon_column is null then
    raise exception 'theatres_geodata_columns_missing';
  end if;

  if v_radius_column is not null then
    execute format(
      'update public.theatres
       set %1$I = $2,
           %2$I = $3,
           %3$I = $4%4$s
       where lower(trim(%5$I::text)) = lower(trim($1::text))',
      v_lat_column,
      v_lon_column,
      v_radius_column,
      case when v_has_updated_at then ', updated_at = now()' else '' end,
      v_name_column
    )
    using v_theatre_name, v_latitude, v_longitude, v_radius_m;
  else
    execute format(
      'update public.theatres
       set %1$I = $2,
           %2$I = $3%3$s
       where lower(trim(%4$I::text)) = lower(trim($1::text))',
      v_lat_column,
      v_lon_column,
      case when v_has_updated_at then ', updated_at = now()' else '' end,
      v_name_column
    )
    using v_theatre_name, v_latitude, v_longitude;
  end if;

  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    if v_radius_column is not null then
      execute format(
        'insert into public.theatres (%1$I, %2$I, %3$I, %4$I)
         values ($1, $2, $3, $4)',
        v_name_column,
        v_lat_column,
        v_lon_column,
        v_radius_column
      )
      using v_theatre_name, v_latitude, v_longitude, v_radius_m;
    else
      execute format(
        'insert into public.theatres (%1$I, %2$I, %3$I)
         values ($1, $2, $3)',
        v_name_column,
        v_lat_column,
        v_lon_column
      )
      using v_theatre_name, v_latitude, v_longitude;
    end if;
  end if;

  if to_regclass('public.events') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'events'
        and column_name = 'theatre'
    ) then
    update public.events
    set theatre = v_theatre_name
    where theatre is not null
      and lower(theatre) like '%rossellini%'
      and theatre <> v_theatre_name;
  end if;
end;
$$;
