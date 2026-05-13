-- Schedule daily imports for Spazio Rossellini and ATCL Lazio events.
-- Uses pg_cron (cron schema) + pg_net (extensions schema).
--
-- After deployment, set the two required database-level settings once:
--   ALTER DATABASE postgres SET app.supabase_url     = 'https://<project-ref>.supabase.co';
--   ALTER DATABASE postgres SET app.service_role_key = '<service_role_key>';
--
-- These are PostgreSQL GUC settings (not exposed outside the DB) and are
-- read at runtime by trigger_edge_import(); the migration itself does not
-- embed any secret.

-- ── Helper function ───────────────────────────────────────────────────────────
create or replace function public.trigger_edge_import(p_source text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base_url   text;
  v_key        text;
  v_fn_url     text;
  v_request_id bigint;
begin
  v_base_url := rtrim(coalesce(current_setting('app.supabase_url',    true), ''), '/');
  v_key      := coalesce(current_setting('app.service_role_key', true), '');

  if v_base_url = '' or v_key = '' then
    raise warning
      'trigger_edge_import: app.supabase_url / app.service_role_key non configurati. '
      'Esegui: ALTER DATABASE postgres SET app.supabase_url = ''...''; '
      'ALTER DATABASE postgres SET app.service_role_key = ''...'';';
    return null;
  end if;

  if p_source = 'spazio-rossellini' then
    v_fn_url := v_base_url || '/functions/v1/import-spazio-rossellini';
  elsif p_source = 'atcl-lazio' then
    v_fn_url := v_base_url || '/functions/v1/import-atcl-lazio';
  else
    raise exception 'trigger_edge_import: source non valido: %', p_source;
  end if;

  select extensions.http_post(
    url     := v_fn_url,
    body    := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    )
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke execute on function public.trigger_edge_import(text) from public;
grant  execute on function public.trigger_edge_import(text) to service_role;

-- ── Cron jobs ─────────────────────────────────────────────────────────────────
do $$
declare
  v_job_id bigint;
begin
  if to_regclass('cron.job') is null then
    raise notice
      'pg_cron non disponibile. Configura manualmente: '
      'cron.schedule(''tdp_import_spazio_rossellini_daily'', ''0 3 * * *'', ...) e '
      'cron.schedule(''tdp_import_atcl_lazio_daily'', ''15 3 * * *'', ...)';
    return;
  end if;

  -- Remove stale jobs before re-scheduling
  for v_job_id in
    select jobid from cron.job
    where jobname in (
      'tdp_import_spazio_rossellini_daily',
      'tdp_import_atcl_lazio_daily'
    )
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  -- Spazio Rossellini: 03:00 UTC
  perform cron.schedule(
    'tdp_import_spazio_rossellini_daily',
    '0 3 * * *',
    $cmd$ select public.trigger_edge_import('spazio-rossellini'); $cmd$
  );

  -- ATCL Lazio: 03:15 UTC (staggered to avoid simultaneous load on the DB writer)
  perform cron.schedule(
    'tdp_import_atcl_lazio_daily',
    '15 3 * * *',
    $cmd$ select public.trigger_edge_import('atcl-lazio'); $cmd$
  );

  raise notice
    'Import schedulati: tdp_import_spazio_rossellini_daily (03:00 UTC), '
    'tdp_import_atcl_lazio_daily (03:15 UTC)';

exception
  when undefined_function then
    raise notice 'pg_cron non disponibile (undefined_function).';
end;
$$;
