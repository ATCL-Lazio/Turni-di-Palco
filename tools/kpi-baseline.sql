-- KPI baseline — Audience development (#321 / parent #164)
--
-- Report ripetibile: rigenera i KPI di audience development di Turni di Palco
-- leggendo lo stato reale del database (nessuno stream di eventi richiesto).
-- I KPI di acquisizione, attivazione, retention ed engagement sono derivabili
-- direttamente dalle tabelle esistenti, quindi la baseline e' raccoglibile in
-- qualsiasi momento, senza attendere una finestra di telemetria.
--
-- Uso (read-only):
--   psql "$SUPABASE_DB_URL" -f tools/kpi-baseline.sql
-- oppure via Supabase SQL editor / MCP execute_sql.
--
-- Permessi: tutti e tre i blocchi leggono direttamente da auth.users ->
-- richiedono ruolo postgres/service_role (bypassano RLS per design). Eseguiti
-- con un ruolo privo di accesso, restituiscono vuoto o un errore di permessi.
--
-- Le definizioni univoche dei KPI sono in TECHNICAL_NOTES.md
-- ("Audience development — KPI & baseline").

-- 1) Funnel di acquisizione -> attivazione + retention -------------------------
with u as (
  select
    au.id,
    au.created_at,
    au.email_confirmed_at,
    au.last_sign_in_at,
    p.role_id,
    p.onboarding_completed_at,
    p.last_activity_at,
    (select count(*) from public.activity_completions ac where ac.user_id = au.id) as activities,
    (select count(*) from public.turns t where t.user_id = au.id) as turns
  from auth.users au
  left join public.profiles p on p.id = au.id
)
select
  'funnel'                                                                          as report,
  count(*)                                                                          as iscritti_totali,
  count(*) filter (where email_confirmed_at is not null)                            as email_confermate,
  count(*) filter (where last_sign_in_at is not null)                              as almeno_un_accesso,
  count(*) filter (where role_id is not null)                                       as ruolo_scelto,
  count(*) filter (where onboarding_completed_at is not null)                       as onboarding_completato,
  count(*) filter (where activities > 0)                                            as almeno_una_attivita,
  count(*) filter (where turns > 0)                                                 as almeno_un_turno,
  count(*) filter (where last_sign_in_at::date > created_at::date)                  as ritornati_giorno_diverso, -- proxy retention D1+ (NULL last_sign_in_at -> escluso dal FILTER)
  count(*) filter (where last_activity_at > now() - interval '30 days')             as attivi_ultimi_30g,
  count(*) filter (where created_at > now() - interval '30 days')                   as iscritti_ultimi_30g,
  round(avg(activities), 1)                                                         as media_attivita_per_utente,
  sum(turns)                                                                        as turni_totali,
  sum(activities)                                                                   as attivita_totali
from u;

-- 2) Engagement eventi reali + copertura contenuti -----------------------------
select
  'engagement'                                                                      as report,
  (select count(*) from public.ticket_activations)                                  as ticket_attivati_totali,
  (select count(distinct activated_by)
     from public.ticket_activations where activated_by is not null)                 as utenti_con_ticket,
  (select count(*) from public.events)                                              as eventi_calendario,
  (select count(distinct role_id) from public.profiles where role_id is not null)   as ruoli_distinti_in_uso,
  (select count(distinct theatre) from public.turns)                                as teatri_con_almeno_un_turno;

-- 3) Acquisizione per mese -----------------------------------------------------
select
  to_char(date_trunc('month', created_at), 'YYYY-MM') as mese,
  count(*)                                            as iscritti
from auth.users
group by 1
order by 1;
