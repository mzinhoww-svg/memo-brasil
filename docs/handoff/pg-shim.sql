-- Shim mínimo do Supabase para testar migrations e pgTAP em um PostgreSQL 16 puro (papéis, auth, storage, vault, cron, net).
-- Uso: PGOPTIONS='-c search_path=public,extensions' psql -d <banco> -f docs/handoff/pg-shim.sql ; depois as migrations em ordem
-- (trocando 'create extension if not exists pg_cron|pg_net ...;' por nada).
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; create role authenticator nologin; create role supabase_admin superuser login;
create schema if not exists extensions; create extension if not exists pgcrypto with schema extensions; create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;
create schema auth; create table auth.users(id uuid primary key default gen_random_uuid(), instance_id uuid, aud text default 'authenticated', role text default 'authenticated', email text, encrypted_password text, phone text, raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}', created_at timestamptz default now(), updated_at timestamptz default now(), is_anonymous boolean default false, last_sign_in_at timestamptz, deleted_at timestamptz, email_confirmed_at timestamptz, confirmed_at timestamptz, banned_until timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub', true),''), nullif(nullif(current_setting('request.jwt.claims', true),'')::jsonb ->> 'sub',''))::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true),''),'anon') $$;
grant usage on schema auth to anon, authenticated, service_role;
create schema storage; create table storage.buckets(id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, metadata jsonb, created_at timestamptz default now(), updated_at timestamptz default now());
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;
grant usage on schema storage to anon, authenticated, service_role; grant all on storage.objects, storage.buckets to authenticated, service_role;
create schema vault; create table vault.secrets(id uuid primary key default gen_random_uuid(), name text unique, secret text); create view vault.decrypted_secrets as select id, name, secret as decrypted_secret from vault.secrets;
create function vault.create_secret(s text, n text default null, d text default null) returns uuid language sql as $$ insert into vault.secrets(name, secret) values (n, s) returning id $$;
create schema cron; create table cron.job(jobid bigserial primary key, jobname text, schedule text, command text, active boolean default true); create table cron.job_run_details(runid bigserial primary key, jobid bigint, status text, start_time timestamptz, end_time timestamptz, return_message text);
create function cron.schedule(n text, s text, c text) returns bigint language sql as $$ insert into cron.job(jobname,schedule,command) values (n,s,c) returning jobid $$;
create function cron.unschedule(n text) returns boolean language sql as $$ delete from cron.job where jobname=n returning true $$;
create function cron.alter_job(job_id bigint, schedule text default null, command text default null, active boolean default null) returns void language sql as $$ select 1 $$;
create schema net; create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 1000) returns bigint language sql as $$ select 1::bigint $$;
create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key, statements text[], name text);
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
