-- GDPR Art. 7 – Prova del consenso cookie: timestamp di accettazione.
-- Il campo viene valorizzato al primo profile_upsert dopo il login,
-- leggendo il valore precedentemente salvato in localStorage.
alter table public.profiles
  add column if not exists cookie_consent_at timestamptz;
