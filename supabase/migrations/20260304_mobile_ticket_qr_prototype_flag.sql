insert into public.mobile_feature_flags (key, enabled, label, description, category)
values (
  'mobile.dev.ticket_qr_prototype',
  false,
  'Prototipo ticket QR (dev)',
  'Abilita il prototipo developer per generazione e attivazione ticket QR nelle impostazioni account.',
  'action'
)
on conflict (key) do update
set
  enabled = excluded.enabled,
  label = excluded.label,
  description = excluded.description,
  category = excluded.category;
