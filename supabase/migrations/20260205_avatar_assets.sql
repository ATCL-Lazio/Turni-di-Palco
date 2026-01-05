alter table public.profiles
  add column if not exists avatar_glb_url text,
  add column if not exists avatar_thumb_url text,
  add column if not exists avatar_updated_at timestamptz;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

alter table storage.objects enable row level security;

drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects
for select
using (bucket_id = 'avatars');
