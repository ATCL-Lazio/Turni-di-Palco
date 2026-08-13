-- Make event_time nullable so imports can store events with no published time
-- rather than fabricating a placeholder value. The stored procedures already
-- handle NULL event_time via COALESCE(event_time, '23:59:59').
ALTER TABLE public.events ALTER COLUMN event_time DROP NOT NULL;
