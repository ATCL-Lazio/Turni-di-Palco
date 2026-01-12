create schema if not exists extensions;

-- pg_net does not support ALTER EXTENSION ... SET SCHEMA, so we recreate it.
drop extension if exists pg_net;
create extension if not exists pg_net with schema extensions;
