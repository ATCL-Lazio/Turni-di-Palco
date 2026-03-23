insert into public.mobile_feature_flags (key, enabled, label, description, category)
values (
  'mobile.action.ticket_entry',
  true,
  'Inserimento numero biglietto',
  'Abilita l''inserimento manuale del numero biglietto come metodo primario di registrazione turno.',
  'action'
)
on conflict (key) do update
set
  enabled = excluded.enabled,
  label = excluded.label,
  description = excluded.description,
  category = excluded.category;
