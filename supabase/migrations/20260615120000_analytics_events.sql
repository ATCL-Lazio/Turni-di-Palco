-- Analytics events sink (issues #321 / #164 — audience development).
--
-- Persistent store for the privacy-first KPI events already emitted by the
-- client (apps/mobile/src/services/analytics.ts). Rows are written ONLY by the
-- `ingest-analytics` Edge Function using the service-role key; there are no
-- RLS policies for anon/authenticated, so clients can never read or write the
-- table directly. User identities are pseudonymized upstream (user_hash is an
-- HMAC-SHA256 digest, never a raw uid / email), so the table holds no PII.
--
-- KPI definitions and how a baseline is collected are documented in
-- TECHNICAL_NOTES.md ("Audience development — KPI & tracking").

create table if not exists public.analytics_events (
  id          bigserial primary key,
  event       text not null,
  user_hash   text,
  props       jsonb not null default '{}'::jsonb,
  ts          timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  -- Closed event set: mirrors AnalyticsEventName in the client. Keep in sync.
  constraint analytics_events_event_check check (event in (
    'session_start',
    'onboarding_started',
    'onboarding_completed',
    'first_scenario_completed',
    'activity_completed',
    'turn_registered',
    'share_clicked'
  ))
);

-- Time-series access patterns: "events of type X over time" and
-- "events for a pseudonymous user over time" (retention/engagement queries).
create index if not exists analytics_events_event_ts_idx
  on public.analytics_events (event, ts desc);

create index if not exists analytics_events_user_hash_ts_idx
  on public.analytics_events (user_hash, ts desc)
  where user_hash is not null;

-- Enable + force RLS with NO policies: the service role (used by the
-- ingest-analytics Edge Function) bypasses RLS, while anon/authenticated
-- clients are denied all direct access by default.
alter table public.analytics_events enable row level security;
alter table public.analytics_events force row level security;

comment on table public.analytics_events is
  'Privacy-first KPI events (audience development #321/#164). Written only by the ingest-analytics Edge Function (service role); pseudonymized, no PII.';
