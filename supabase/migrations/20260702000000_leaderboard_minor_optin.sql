-- Tutela minori: la classifica pubblica diventa OPT-IN per i minorenni.
--
-- Finora leaderboard_visible aveva default true per tutti (opt-out). Per i
-- minorenni (target dell'app: 14-17) l'esposizione pubblica di nickname, foto e
-- statistiche non deve essere l'impostazione predefinita: partono nascosti e
-- possono rendersi visibili esplicitamente da "Gestisci account → Privacy".
--
-- Il flag `is_minor` è calcolato al signup (età < 18) e propagato tramite i
-- metadati utente; non memorizziamo la data di nascita.

alter table public.profiles
  add column if not exists is_minor boolean not null default false;

-- Aggiorna il trigger di creazione profilo: legge is_minor dai metadati e, per i
-- minorenni, imposta leaderboard_visible = false (classifica opt-in). Per i
-- maggiorenni il comportamento resta invariato (visibile per default).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_minor boolean := coalesce((new.raw_user_meta_data->>'is_minor')::boolean, false);
begin
  insert into public.profiles (id, name, email, role_id, is_minor, leaderboard_visible)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'Player'),
    new.email,
    'attore',
    v_is_minor,
    not v_is_minor
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
