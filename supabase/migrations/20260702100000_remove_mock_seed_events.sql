-- Rimuove i 3 eventi mock seedati da 20251230_init_game_schema.sql
-- (ATCL-001/002/003: "Prova aperta", "Festival Giovani Voci", "Prima nazionale").
--
-- Non sono eventi reali del circuito ATCL: erano placeholder di sviluppo. Gli
-- eventi reali entrano esclusivamente dagli importer live (edge functions
-- `import-spazio-rossellini` e `import-atcl-lazio`, schedulati in
-- 20260513_daily_import_schedule.sql), che usano id con prefisso `SR-<id>` /
-- `ATCL-<slug>` e non collidono con questi id numerici.
--
-- Idempotente: se gli eventi non esistono (DB già pulito o importer già
-- popolato) la delete non fa nulla. Le FK verso questi eventi degradano in
-- sicurezza: turns.event_id -> set null (lo storico turno resta con i suoi
-- snapshot denormalizzati), planned_participations/ticket_activations -> cascade.

delete from public.events
where id in ('ATCL-001', 'ATCL-002', 'ATCL-003');
