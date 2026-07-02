-- Remap del teatro mock "Teatro di Latina" al nome reale del circuito ATCL:
-- "Teatro Comunale D'Annunzio" (la sede reale di Latina, ora in public.theatres).
--
-- "Teatro di Latina" proveniva dall'evento seed mock ATCL-001 ("Prova aperta -
-- Teatro di Latina"), rimosso in 20260702100000. L'evento è sparito ma il nome
-- del teatro restava nella storia utente denormalizzata e nei record
-- persistenti, puntando a una sede che il registro reale non conosce (quindi
-- incoerente con reputazione teatro e geofence).
--
-- Allinea al registro reale aggiornando le tre sedi di storage fisico del nome
-- teatro. La reputazione teatro (view my_theatre_reputation e funzione
-- get_public_profile_theatres) è DERIVATA da turns.theatre, quindi si ricalcola
-- da sola dopo l'update; non esiste una tabella reputazione da toccare.
--
-- Idempotente. Sicuro rispetto alla PK (user_id, theatre) di
-- theatre_reputation_adjustments: in caso di collisione con una riga già
-- esistente per il nome reale, i due record vengono uniti (somma adjustment,
-- timestamp più recenti) prima del rename.

do $$
declare
  v_old constant text := 'Teatro di Latina';
  v_new constant text := 'Teatro Comunale D''Annunzio';
begin
  -- 1) Snapshot turni: sorgente della reputazione teatro (view derivata).
  if to_regclass('public.turns') is not null then
    update public.turns
       set theatre = v_new
     where theatre = v_old;
  end if;

  -- 2) Record storico acquisti "rep_theatre" (nessun vincolo di unicità).
  if to_regclass('public.shop_purchases') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'shop_purchases'
         and column_name = 'target_theatre'
     ) then
    update public.shop_purchases
       set target_theatre = v_new
     where target_theatre = v_old;
  end if;

  -- 3) Aggiustamenti reputazione persistenti (PK user_id, theatre).
  if to_regclass('public.theatre_reputation_adjustments') is not null then
    -- 3a) Merge nelle righe già esistenti per il nome reale.
    update public.theatre_reputation_adjustments t
       set adjustment       = t.adjustment + s.adjustment,
           last_activity_at  = greatest(t.last_activity_at, s.last_activity_at),
           last_decay_at     = greatest(t.last_decay_at, s.last_decay_at),
           updated_at        = now()
      from public.theatre_reputation_adjustments s
     where s.user_id = t.user_id
       and s.theatre = v_old
       and t.theatre = v_new;

    -- 3b) Elimina le vecchie righe già confluite in un record reale.
    delete from public.theatre_reputation_adjustments o
     where o.theatre = v_old
       and exists (
         select 1 from public.theatre_reputation_adjustments n
         where n.user_id = o.user_id
           and n.theatre = v_new
       );

    -- 3c) Rinomina le rimanenti (nessuna collisione).
    update public.theatre_reputation_adjustments
       set theatre = v_new,
           updated_at = now()
     where theatre = v_old;
  end if;
end;
$$;
