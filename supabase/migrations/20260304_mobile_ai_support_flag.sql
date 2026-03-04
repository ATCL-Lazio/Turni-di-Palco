insert into public.mobile_feature_flags (key, enabled, label, description, category)
values (
  'mobile.action.ai_support',
  true,
  'Supporto AI',
  'Abilita accesso al Supporto AI nelle impostazioni account dell app mobile.',
  'action'
)
on conflict (key) do update
set
  enabled = excluded.enabled,
  label = excluded.label,
  description = excluded.description,
  category = excluded.category;
