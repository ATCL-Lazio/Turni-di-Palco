insert into public.roles (id, name, focus, stats)
values (
  'rspp',
  'RSPP',
  'Sicurezza e prevenzione',
  '{"presence":65,"precision":92,"leadership":88,"creativity":58}'
)
on conflict (id) do update set
  name = excluded.name,
  focus = excluded.focus,
  stats = excluded.stats;
