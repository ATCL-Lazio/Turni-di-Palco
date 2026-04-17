-- Issue #476: aggiungi valore 'system' alla colonna theme (segue tema OS)
alter table profiles
  drop constraint if exists profiles_theme_check;

alter table profiles
  add constraint profiles_theme_check check (theme in ('dark', 'light', 'system'));

-- Aggiorna il default a 'system' per i nuovi utenti
alter table profiles
  alter column theme set default 'system';
