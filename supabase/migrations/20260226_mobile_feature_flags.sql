create table if not exists public.mobile_feature_flags (
  key text primary key,
  enabled boolean not null,
  label text not null,
  description text not null default '',
  category text not null check (category in ('section', 'action')),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create or replace function public.set_mobile_feature_flag_updated_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_by := auth.uid();
  return new;
end;
$$;

revoke all on function public.set_mobile_feature_flag_updated_by() from public;
grant execute on function public.set_mobile_feature_flag_updated_by() to authenticated;

drop trigger if exists set_mobile_feature_flags_updated_at on public.mobile_feature_flags;
create trigger set_mobile_feature_flags_updated_at
before update on public.mobile_feature_flags
for each row execute function public.set_updated_at();

drop trigger if exists set_mobile_feature_flags_updated_by on public.mobile_feature_flags;
create trigger set_mobile_feature_flags_updated_by
before insert or update on public.mobile_feature_flags
for each row execute function public.set_mobile_feature_flag_updated_by();

alter table public.mobile_feature_flags enable row level security;
alter table public.mobile_feature_flags force row level security;

drop policy if exists "mobile feature flags read authenticated" on public.mobile_feature_flags;
create policy "mobile feature flags read authenticated"
on public.mobile_feature_flags
for select
to authenticated
using ((select auth.uid()) is not null);

drop policy if exists "mobile feature flags write dev roles" on public.mobile_feature_flags;
create policy "mobile feature flags write dev roles"
on public.mobile_feature_flags
for insert
to authenticated
with check (
  public.control_plane_has_any_role(
    array[
      'control_admin',
      'control_operator',
      'control_auditor',
      'dev_admin',
      'dev_operator',
      'dev_viewer'
    ]::text[]
  )
);

drop policy if exists "mobile feature flags update dev roles" on public.mobile_feature_flags;
create policy "mobile feature flags update dev roles"
on public.mobile_feature_flags
for update
to authenticated
using (
  public.control_plane_has_any_role(
    array[
      'control_admin',
      'control_operator',
      'control_auditor',
      'dev_admin',
      'dev_operator',
      'dev_viewer'
    ]::text[]
  )
)
with check (
  public.control_plane_has_any_role(
    array[
      'control_admin',
      'control_operator',
      'control_auditor',
      'dev_admin',
      'dev_operator',
      'dev_viewer'
    ]::text[]
  )
);

revoke all on table public.mobile_feature_flags from anon;
revoke all on table public.mobile_feature_flags from authenticated;
grant select, insert, update on table public.mobile_feature_flags to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'mobile_feature_flags'
    ) then
      alter publication supabase_realtime add table public.mobile_feature_flags;
    end if;
  end if;
end;
$$;

insert into public.mobile_feature_flags (key, enabled, label, description, category)
values
  ('mobile.section.turns', true, 'Sezione Turni', 'Mostra la sezione turni ATCL e la relativa tab.', 'section'),
  ('mobile.section.leaderboard', true, 'Sezione Classifica', 'Mostra la sezione classifica e la relativa tab.', 'section'),
  ('mobile.section.activities', true, 'Sezione Attivita', 'Mostra la sezione attivita simulate e la relativa tab.', 'section'),
  ('mobile.section.shop', true, 'Sezione Shop', 'Mostra la sezione shop e la relativa tab.', 'section'),
  ('mobile.section.career', true, 'Sezione Carriera', 'Abilita la schermata carriera dal profilo.', 'section'),
  ('mobile.section.earned_titles', true, 'Sezione Titoli', 'Abilita la schermata titoli sbloccati dal profilo.', 'section'),
  ('mobile.action.qr_scan', true, 'Azione Scansione QR', 'Abilita la scansione QR per registrazione turni.', 'action'),
  ('mobile.action.turn_submit', true, 'Azione Conferma Turno', 'Abilita la registrazione dei turni.', 'action'),
  ('mobile.action.turn_boost', true, 'Azione Boost Turno', 'Abilita il boost con token ATCL in conferma turno.', 'action'),
  ('mobile.action.activity_start', true, 'Azione Avvio Attivita', 'Abilita l''avvio dei minigame attivita.', 'action'),
  ('mobile.action.activity_complete', true, 'Azione Completamento Attivita', 'Abilita il salvataggio finale attivita e ricompense.', 'action'),
  ('mobile.action.shop_purchase', true, 'Azione Acquisto Shop', 'Abilita l''acquisto di elementi nel negozio.', 'action')
on conflict (key) do update
set
  enabled = excluded.enabled,
  label = excluded.label,
  description = excluded.description,
  category = excluded.category;
