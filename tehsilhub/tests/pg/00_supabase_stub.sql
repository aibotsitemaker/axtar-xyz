-- Supabase-in minimal təqlidi (YALNIZ TEST bazası üçün). Real Supabase layihəsində İŞLƏTMƏYİN.
-- auth.users, auth.uid(), storage.*, rollar, supabase_realtime publication.
do $$ begin
  begin create role anon nologin; exception when duplicate_object then null; end;
  begin create role authenticated nologin; exception when duplicate_object then null; end;
  begin create role service_role nologin bypassrls; exception when duplicate_object then null; end;
end $$;
create extension if not exists pg_trgm;
create extension if not exists pgcrypto;
create schema if not exists auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
-- Real Supabase-də auth.uid() "sub" iddiasını JWT-dən oxuyur (request.jwt.claim.sub / request.jwt.claims)
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
$$;
create schema if not exists storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
create publication supabase_realtime;
grant usage on schema public, auth, storage to anon, authenticated, service_role;
-- Yeni Supabase layihələri (2026) cədvəllərə avtomatik icazə VERMİR; testdə də verməyək (04_grants.sql lazımdır)
grant all on all tables in schema storage to anon, authenticated, service_role;
