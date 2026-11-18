-- profile-images hardening (#1684)
--
-- 1. Il bucket e' pubblico: gli URL diretti /storage/v1/object/public/... NON
--    passano da RLS, quindi la visualizzazione delle immagini non dipende dalla
--    policy SELECT. La policy bucket-wide permetteva invece a chiunque di
--    elencare tutti gli oggetti (e quindi gli user id, anche di utenti nascosti
--    dalla classifica). La sostituiamo con una SELECT limitata alla propria
--    cartella: serve ancora a upload con upsert e a remove() fatti dal client.
-- 2. profiles.profile_image deve essere NULL oppure l'URL pubblico di questo
--    progetto per l'immagine del proprietario. Validato da trigger; i valori
--    esistenti non vengono toccati (la validazione scatta solo se il valore
--    cambia), cosi' righe legacy non bloccano altri update del profilo.
--
-- Rollback:
--   drop trigger if exists validate_profile_image_url on public.profiles;
--   drop function if exists public.validate_profile_image_url();
--   drop policy if exists "Users can read their own profile images" on storage.objects;
--   create policy "Profile images are publicly accessible" on storage.objects
--     for select to public using (bucket_id = 'profile-images');
--
-- NB: l'host del progetto e' fissato nella funzione; cambiarlo se si applica
-- la migration a un altro progetto (staging).

-- ---------------------------------------------------------------------------
-- 1. storage.objects: niente listing bucket-wide
-- ---------------------------------------------------------------------------
drop policy if exists "Profile images are publicly accessible" on storage.objects;
drop policy if exists "Users can read their own profile images" on storage.objects;

create policy "Users can read their own profile images"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'profile-images'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

-- ---------------------------------------------------------------------------
-- 2. profiles.profile_image: solo URL pubblico dell'immagine del proprietario
-- ---------------------------------------------------------------------------
create or replace function public.validate_profile_image_url()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_prefix constant text :=
    'https://nskdqxntfxtwnbtunpgm.supabase.co/storage/v1/object/public/profile-images/';
begin
  if new.profile_image is null then
    return new;
  end if;
  -- Valori invariati (anche legacy) non vengono rivalidati.
  if tg_op = 'UPDATE' and new.profile_image is not distinct from old.profile_image then
    return new;
  end if;
  -- Funzioni SECURITY DEFINER / service_role / migration non sono vincolate.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if left(new.profile_image, length(v_prefix)) <> v_prefix
     or substr(new.profile_image, length(v_prefix) + 1)
        !~ ('^' || new.id::text || '/profile\.(jpg|png|webp|gif)(\?v=[0-9]{1,16})?$') then
    raise exception 'profile_image must be the public profile-images URL of the owner'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_profile_image_url on public.profiles;
create trigger validate_profile_image_url
  before insert or update of profile_image on public.profiles
  for each row execute function public.validate_profile_image_url();
