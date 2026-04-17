-- Issue #476: accessibility preferences (theme, accessible mode)
alter table profiles
  add column if not exists theme text default 'dark' check (theme in ('dark', 'light')),
  add column if not exists accessible_mode boolean default false;
