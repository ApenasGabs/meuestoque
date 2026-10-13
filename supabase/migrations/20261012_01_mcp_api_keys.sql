-- MCP Personal Access Tokens (issue #36)
--
-- Long-lived API keys for MCP clients. The key is exchanged, inside Postgres,
-- for a 5-minute JWT (role=authenticated, sub=user_id) so every existing RLS
-- policy keeps applying unchanged. No service_role or signing secret is needed
-- on Vercel: the HS256 secret lives in Supabase Vault under 'mcp_jwt_secret'.
--
-- Manual prerequisite (once per project, see docs/features/feature-mcp-persistent-tokens.md):
--   select vault.create_secret('<HS256 secret accepted by the project>', 'mcp_jwt_secret');

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.mcp_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  key_prefix text not null,
  key_hash text not null unique,
  scopes text[] not null default array['read', 'write']
    check (cardinality(scopes) > 0 and scopes <@ array['read', 'write']),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  constraint mcp_api_keys_max_lifetime check (expires_at <= created_at + interval '366 days')
);

create index if not exists mcp_api_keys_user_active_idx
  on public.mcp_api_keys (user_id) where revoked_at is null;

alter table public.mcp_api_keys enable row level security;

drop policy if exists mcp_keys_select_own on public.mcp_api_keys;
create policy mcp_keys_select_own on public.mcp_api_keys
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Direct writes are forbidden; lifecycle goes through the RPCs below.
revoke all on public.mcp_api_keys from anon, authenticated;
grant select (id, user_id, name, key_prefix, scopes, created_at, last_used_at, expires_at, revoked_at)
  on public.mcp_api_keys to authenticated;

-- base64url without padding/newlines
create or replace function public.mcp_base64url(p_data bytea)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(rtrim(replace(encode(p_data, 'base64'), E'\n', ''), '='), '+/', '-_');
$$;
revoke all on function public.mcp_base64url(bytea) from public, anon, authenticated;

create or replace function public.create_mcp_api_key(
  p_name text,
  p_days integer default 90,
  p_scopes text[] default array['read', 'write']
)
returns table (id uuid, api_key text, key_prefix text, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_key text;
  v_id uuid;
  v_expires timestamptz;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_days is null or p_days < 1 or p_days > 365 then
    raise exception 'p_days must be between 1 and 365' using errcode = '22023';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 60 then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  if (
    select count(*) from public.mcp_api_keys k
    where k.user_id = v_uid and k.revoked_at is null and k.expires_at > now()
  ) >= 10 then
    raise exception 'active key limit reached' using errcode = 'P0001';
  end if;

  v_key := 'mest_pat_' || public.mcp_base64url(extensions.gen_random_bytes(32));
  v_expires := now() + make_interval(days => p_days);

  insert into public.mcp_api_keys (user_id, name, key_prefix, key_hash, scopes, expires_at)
  values (
    v_uid,
    btrim(p_name),
    left(v_key, 15),
    encode(extensions.digest(v_key, 'sha256'), 'hex'),
    coalesce(p_scopes, array['read', 'write']),
    v_expires
  )
  returning mcp_api_keys.id into v_id;

  return query select v_id, v_key, left(v_key, 15), v_expires;
end;
$$;
revoke all on function public.create_mcp_api_key(text, integer, text[]) from public, anon;
grant execute on function public.create_mcp_api_key(text, integer, text[]) to authenticated;

create or replace function public.revoke_mcp_api_key(p_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_count integer;
begin
  update public.mcp_api_keys
     set revoked_at = now()
   where id = p_id and user_id = auth.uid() and revoked_at is null;
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;
revoke all on function public.revoke_mcp_api_key(uuid) from public, anon;
grant execute on function public.revoke_mcp_api_key(uuid) to authenticated;

create or replace function public.revoke_all_mcp_api_keys()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_count integer;
begin
  update public.mcp_api_keys
     set revoked_at = now()
   where user_id = auth.uid() and revoked_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.revoke_all_mcp_api_keys() from public, anon;
grant execute on function public.revoke_all_mcp_api_keys() to authenticated;

-- Exchanges a valid key for a short-lived JWT. Returns no row on any failure
-- (no reason is disclosed). Safe to expose to anon: keys carry 256 bits of
-- entropy and nothing is written for invalid input.
create or replace function public.exchange_mcp_api_key(p_key text)
returns table (access_token text, user_id uuid, scopes text[])
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_row public.mcp_api_keys%rowtype;
  v_secret text;
  v_now bigint := extract(epoch from now())::bigint;
  v_header text;
  v_payload text;
  v_signing_input text;
begin
  if p_key is null or p_key !~ '^mest_pat_[A-Za-z0-9_-]{43}$' then
    return;
  end if;

  select * into v_row
    from public.mcp_api_keys k
   where k.key_hash = encode(extensions.digest(p_key, 'sha256'), 'hex')
     and k.revoked_at is null
     and k.expires_at > now();
  if not found then
    return;
  end if;

  select ds.decrypted_secret into v_secret
    from vault.decrypted_secrets ds
   where ds.name = 'mcp_jwt_secret'
   limit 1;
  if v_secret is null then
    raise warning 'mcp_jwt_secret missing in vault';
    return;
  end if;

  update public.mcp_api_keys
     set last_used_at = now()
   where id = v_row.id
     and (last_used_at is null or last_used_at < now() - interval '5 minutes');

  v_header := public.mcp_base64url(convert_to('{"alg":"HS256","typ":"JWT"}', 'utf8'));
  v_payload := public.mcp_base64url(convert_to(json_build_object(
    'aud', 'authenticated',
    'role', 'authenticated',
    'sub', v_row.user_id,
    'iat', v_now,
    'exp', v_now + 300,
    'is_anonymous', false,
    'mcp_key_id', v_row.id,
    'mcp_scopes', v_row.scopes
  )::text, 'utf8'));
  v_signing_input := v_header || '.' || v_payload;

  return query select
    v_signing_input || '.' || public.mcp_base64url(
      extensions.hmac(convert_to(v_signing_input, 'utf8'), convert_to(v_secret, 'utf8'), 'sha256')
    ),
    v_row.user_id,
    v_row.scopes;
end;
$$;
revoke all on function public.exchange_mcp_api_key(text) from public;
grant execute on function public.exchange_mcp_api_key(text) to anon, authenticated;
