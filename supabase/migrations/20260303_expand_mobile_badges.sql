delete from public.badges
where id = 'first_season';

insert into public.badges (id, title, description, icon, metric, threshold)
values
  ('first_turn', 'Primo sipario', 'Registra il tuo primo turno ATCL.', 'Award', 'total_turns', 1),
  ('turns_this_month_3', 'Ritmo di scena', 'Completa 3 turni nello stesso mese.', 'Calendar', 'turns_this_month', 3),
  ('unique_theatres_3', 'Teatri in tour', 'Lavora in 3 teatri diversi.', 'MapPin', 'unique_theatres', 3),
  ('total_turns_10', 'Presenza costante', 'Raggiungi 10 turni registrati.', 'Theater', 'total_turns', 10),
  ('turns_this_month_6', 'Settimana piena', 'Completa 6 turni nello stesso mese.', 'Calendar', 'turns_this_month', 6),
  ('unique_theatres_5', 'Compagnia itinerante', 'Lavora in 5 teatri diversi.', 'MapPin', 'unique_theatres', 5),
  ('total_turns_25', 'Veterano di palco', 'Raggiungi 25 turni registrati.', 'Award', 'total_turns', 25),
  ('unique_theatres_8', 'Mappa completa', 'Lavora in 8 teatri diversi.', 'MapPin', 'unique_theatres', 8)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  icon = excluded.icon,
  metric = excluded.metric,
  threshold = excluded.threshold;

do $$
declare
  v_user_id uuid;
begin
  for v_user_id in
    select distinct t.user_id
    from public.turns t
    where t.user_id is not null
  loop
    perform public.evaluate_badges_for_user(v_user_id);
  end loop;
end;
$$;
