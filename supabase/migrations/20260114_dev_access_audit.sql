create table if not exists public.dev_access_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  user_email text,
  user_roles text[] not null default '{}',
  path text,
  reason text not null default 'not_allowed',
  created_at timestamptz not null default now()
);

alter table public.dev_access_audit enable row level security;
