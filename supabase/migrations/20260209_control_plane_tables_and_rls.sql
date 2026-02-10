create table if not exists public.control_plane_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('control_admin', 'control_operator', 'control_auditor')),
  granted_by uuid references auth.users(id) on delete set null,
  grant_reason text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  revocation_reason text,
  constraint control_plane_roles_revocation_consistency check (
    (revoked_at is null and revoked_by is null and revocation_reason is null)
    or (revoked_at is not null and revoked_by is not null)
  )
);

create unique index if not exists control_plane_roles_active_unique_idx
  on public.control_plane_roles (user_id, role)
  where revoked_at is null;

create index if not exists control_plane_roles_role_idx
  on public.control_plane_roles (role);

create table if not exists public.control_plane_confirmations (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete set null,
  rejected_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'rejected', 'cancelled', 'expired')
  ),
  scope text not null,
  target text not null,
  reason text,
  approval_note text,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  rejected_at timestamptz,
  cancelled_at timestamptz,
  constraint control_plane_confirmations_status_consistency check (
    (status = 'pending' and approved_at is null and rejected_at is null and cancelled_at is null)
    or (
      status = 'approved'
      and approved_by is not null
      and approved_at is not null
      and rejected_at is null
      and cancelled_at is null
    )
    or (
      status = 'rejected'
      and rejected_by is not null
      and rejected_at is not null
      and approved_at is null
      and cancelled_at is null
    )
    or (
      status = 'cancelled'
      and cancelled_at is not null
      and approved_at is null
      and rejected_at is null
    )
    or (status = 'expired' and approved_at is null and rejected_at is null and cancelled_at is null)
  )
);

create index if not exists control_plane_confirmations_requested_by_idx
  on public.control_plane_confirmations (requested_by, status, created_at desc);

create index if not exists control_plane_confirmations_pending_expiry_idx
  on public.control_plane_confirmations (expires_at)
  where status = 'pending';

create table if not exists public.control_plane_executions (
  id uuid primary key default gen_random_uuid(),
  confirmation_id uuid references public.control_plane_confirmations(id) on delete set null,
  requested_by uuid not null references auth.users(id) on delete restrict,
  executed_by uuid references auth.users(id) on delete set null,
  status text not null default 'queued' check (
    status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')
  ),
  operation text not null,
  target text,
  input_payload jsonb not null default '{}'::jsonb,
  result_payload jsonb,
  error_message text,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint control_plane_executions_started_after_request check (
    started_at is null or started_at >= requested_at
  ),
  constraint control_plane_executions_finished_after_start check (
    finished_at is null or (started_at is not null and finished_at >= started_at)
  )
);

create index if not exists control_plane_executions_requested_by_idx
  on public.control_plane_executions (requested_by, status, created_at desc);

create index if not exists control_plane_executions_confirmation_idx
  on public.control_plane_executions (confirmation_id);

create index if not exists control_plane_executions_running_idx
  on public.control_plane_executions (status, started_at)
  where status in ('queued', 'running');

create table if not exists public.control_plane_audit (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  request_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists control_plane_audit_created_at_idx
  on public.control_plane_audit (created_at desc);

create index if not exists control_plane_audit_actor_idx
  on public.control_plane_audit (actor_user_id, created_at desc);

drop trigger if exists set_control_plane_confirmations_updated_at on public.control_plane_confirmations;
create trigger set_control_plane_confirmations_updated_at
before update on public.control_plane_confirmations
for each row execute function public.set_updated_at();

drop trigger if exists set_control_plane_executions_updated_at on public.control_plane_executions;
create trigger set_control_plane_executions_updated_at
before update on public.control_plane_executions
for each row execute function public.set_updated_at();

create or replace function public.control_plane_user_roles()
returns text[]
language sql
stable
as $$
with claims as (
  select coalesce(auth.jwt(), '{}'::jsonb) as jwt_claims
),
app_metadata as (
  select
    claims.jwt_claims #> '{app_metadata,roles}' as roles_claim,
    nullif(trim(claims.jwt_claims #>> '{app_metadata,role}'), '') as role_claim
  from claims
),
roles_list as (
  select coalesce(
    array_agg(distinct role_name) filter (where role_name <> ''),
    '{}'::text[]
  ) as roles
  from (
    select trim(role_item) as role_name
    from app_metadata,
    lateral jsonb_array_elements_text(
      case jsonb_typeof(app_metadata.roles_claim)
        when 'array' then app_metadata.roles_claim
        when 'string' then to_jsonb(
          regexp_split_to_array(
            trim(both '"' from app_metadata.roles_claim::text),
            '\s*,\s*'
          )
        )
        else '[]'::jsonb
      end
    ) as role_item
  ) parsed_roles
)
select coalesce(
  (
    select array_agg(distinct role_entry) filter (where role_entry <> '')
    from unnest(
      roles_list.roles ||
      case
        when app_metadata.role_claim is null then '{}'::text[]
        else array[app_metadata.role_claim]
      end
    ) as role_entry
  ),
  '{}'::text[]
)
from roles_list, app_metadata;
$$;

create or replace function public.control_plane_has_any_role(required_roles text[])
returns boolean
language sql
stable
as $$
select
  (select auth.uid()) is not null
  and coalesce(array_length(required_roles, 1), 0) > 0
  and exists (
    select 1
    from unnest(public.control_plane_user_roles()) as role_name
    where role_name = any(required_roles)
  );
$$;

revoke all on function public.control_plane_user_roles() from public;
grant execute on function public.control_plane_user_roles() to authenticated;

revoke all on function public.control_plane_has_any_role(text[]) from public;
grant execute on function public.control_plane_has_any_role(text[]) to authenticated;

alter table public.control_plane_roles enable row level security;
alter table public.control_plane_confirmations enable row level security;
alter table public.control_plane_executions enable row level security;
alter table public.control_plane_audit enable row level security;

alter table public.control_plane_roles force row level security;
alter table public.control_plane_confirmations force row level security;
alter table public.control_plane_executions force row level security;
alter table public.control_plane_audit force row level security;

drop policy if exists "control plane roles select scoped" on public.control_plane_roles;
create policy "control plane roles select scoped" on public.control_plane_roles
for select
to authenticated
using (
  public.control_plane_has_any_role(array['control_admin', 'control_auditor']::text[])
  or (select auth.uid()) = user_id
);

drop policy if exists "control plane roles insert admin" on public.control_plane_roles;
create policy "control plane roles insert admin" on public.control_plane_roles
for insert
to authenticated
with check (
  public.control_plane_has_any_role(array['control_admin']::text[])
);

drop policy if exists "control plane roles update admin" on public.control_plane_roles;
create policy "control plane roles update admin" on public.control_plane_roles
for update
to authenticated
using (
  public.control_plane_has_any_role(array['control_admin']::text[])
)
with check (
  public.control_plane_has_any_role(array['control_admin']::text[])
);

drop policy if exists "control plane confirmations select scoped" on public.control_plane_confirmations;
create policy "control plane confirmations select scoped" on public.control_plane_confirmations
for select
to authenticated
using (
  public.control_plane_has_any_role(array['control_admin', 'control_operator', 'control_auditor']::text[])
  or (select auth.uid()) = requested_by
  or (select auth.uid()) = approved_by
  or (select auth.uid()) = rejected_by
);

drop policy if exists "control plane confirmations insert own" on public.control_plane_confirmations;
create policy "control plane confirmations insert own" on public.control_plane_confirmations
for insert
to authenticated
with check (
  public.control_plane_has_any_role(array['control_admin', 'control_operator']::text[])
  and (select auth.uid()) = requested_by
);

drop policy if exists "control plane confirmations update admin" on public.control_plane_confirmations;
create policy "control plane confirmations update admin" on public.control_plane_confirmations
for update
to authenticated
using (
  public.control_plane_has_any_role(array['control_admin']::text[])
)
with check (
  public.control_plane_has_any_role(array['control_admin']::text[])
);

drop policy if exists "control plane executions select scoped" on public.control_plane_executions;
create policy "control plane executions select scoped" on public.control_plane_executions
for select
to authenticated
using (
  public.control_plane_has_any_role(array['control_admin', 'control_operator', 'control_auditor']::text[])
  or (select auth.uid()) = requested_by
  or (select auth.uid()) = executed_by
);

drop policy if exists "control plane executions insert own" on public.control_plane_executions;
create policy "control plane executions insert own" on public.control_plane_executions
for insert
to authenticated
with check (
  public.control_plane_has_any_role(array['control_admin', 'control_operator']::text[])
  and (select auth.uid()) = requested_by
);

drop policy if exists "control plane executions update scoped" on public.control_plane_executions;
create policy "control plane executions update scoped" on public.control_plane_executions
for update
to authenticated
using (
  public.control_plane_has_any_role(array['control_admin']::text[])
  or (
    public.control_plane_has_any_role(array['control_operator']::text[])
    and ((select auth.uid()) = requested_by or (select auth.uid()) = executed_by)
  )
)
with check (
  public.control_plane_has_any_role(array['control_admin']::text[])
  or (
    public.control_plane_has_any_role(array['control_operator']::text[])
    and ((select auth.uid()) = requested_by or (select auth.uid()) = executed_by)
  )
);

drop policy if exists "control plane audit select admin-auditor" on public.control_plane_audit;
create policy "control plane audit select admin-auditor" on public.control_plane_audit
for select
to authenticated
using (
  public.control_plane_has_any_role(array['control_admin', 'control_auditor']::text[])
);

drop policy if exists "control plane audit insert admin-operator" on public.control_plane_audit;
create policy "control plane audit insert admin-operator" on public.control_plane_audit
for insert
to authenticated
with check (
  public.control_plane_has_any_role(array['control_admin', 'control_operator']::text[])
  and (actor_user_id is null or actor_user_id = (select auth.uid()))
);

revoke all on table public.control_plane_roles from anon;
revoke all on table public.control_plane_confirmations from anon;
revoke all on table public.control_plane_executions from anon;
revoke all on table public.control_plane_audit from anon;

revoke all on table public.control_plane_roles from authenticated;
revoke all on table public.control_plane_confirmations from authenticated;
revoke all on table public.control_plane_executions from authenticated;
revoke all on table public.control_plane_audit from authenticated;

grant select, insert, update on table public.control_plane_roles to authenticated;
grant select, insert, update on table public.control_plane_confirmations to authenticated;
grant select, insert, update on table public.control_plane_executions to authenticated;
grant select, insert on table public.control_plane_audit to authenticated;
