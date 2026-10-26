-- MCP OAuth 2.1 Server Support (issue #40)
--
-- Enables Claude.ai Web and remote MCP clients to connect using standard
-- OAuth 2.1 with PKCE (S256), RFC 8414 and RFC 9728 metadata.
--
-- 1. Authorization codes are short-lived (10 min) and stored as sha256 hashes.
-- 2. Code exchange enforces PKCE S256 and single-use guarantee.
-- 3. Emits persistent OAuth token (mest_oa_...) recorded in mcp_api_keys for 365 days,
--    which can be revoked by the user at any time in the Profile page.
-- 4. Updates exchange_mcp_api_key to accept both mest_pat_ and mest_oa_.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.mcp_oauth_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null check (char_length(btrim(client_id)) between 1 and 255),
  code_hash text not null unique,
  code_challenge text not null check (char_length(code_challenge) between 40 and 128),
  redirect_uri text not null check (
    redirect_uri ~ '^https://' or
    redirect_uri ~ '^http://(localhost|127\.0\.0\.1)(:[0-9]+)?(/.*)?$'
  ),
  scopes text[] not null default array['read', 'write']
    check (cardinality(scopes) > 0 and scopes <@ array['read', 'write']),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  used_at timestamptz
);

create index if not exists mcp_oauth_codes_hash_idx
  on public.mcp_oauth_codes (code_hash) where used_at is null;

alter table public.mcp_oauth_codes enable row level security;
revoke all on public.mcp_oauth_codes from anon, authenticated;

-- Creates an authorization code for an authenticated user on the consent screen
create or replace function public.create_mcp_oauth_code(
  p_client_id text,
  p_code_challenge text,
  p_redirect_uri text,
  p_scopes text[] default array['read', 'write']
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_code text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_client_id is null or char_length(btrim(p_client_id)) not between 1 and 255 then
    raise exception 'invalid client_id' using errcode = '22023';
  end if;
  if p_code_challenge is null or char_length(p_code_challenge) not between 40 and 128 then
    raise exception 'invalid code_challenge' using errcode = '22023';
  end if;
  if p_redirect_uri is null or (
    p_redirect_uri !~ '^https://' and
    p_redirect_uri !~ '^http://(localhost|127\.0\.0\.1)(:[0-9]+)?(/.*)?$'
  ) then
    raise exception 'invalid redirect_uri' using errcode = '22023';
  end if;

  v_code := 'mest_code_' || public.mcp_base64url(extensions.gen_random_bytes(32));

  insert into public.mcp_oauth_codes (
    user_id, client_id, code_hash, code_challenge, redirect_uri, scopes, expires_at
  ) values (
    v_uid,
    btrim(p_client_id),
    encode(extensions.digest(v_code, 'sha256'), 'hex'),
    p_code_challenge,
    p_redirect_uri,
    coalesce(p_scopes, array['read', 'write']),
    now() + interval '10 minutes'
  );

  return v_code;
end;
$$;
revoke all on function public.create_mcp_oauth_code(text, text, text, text[]) from public, anon;
grant execute on function public.create_mcp_oauth_code(text, text, text, text[]) to authenticated;

-- Exchanges an authorization code and PKCE code_verifier for an access token
create or replace function public.exchange_mcp_oauth_code(
  p_code text,
  p_code_verifier text,
  p_redirect_uri text,
  p_client_id text default null
)
returns table (
  access_token text,
  token_type text,
  expires_in integer,
  scope text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_row public.mcp_oauth_codes%rowtype;
  v_computed_challenge text;
  v_token text;
  v_token_hash text;
  v_name text;
begin
  if p_code is null or p_code !~ '^mest_code_[A-Za-z0-9_-]{43}$' then
    return;
  end if;
  if p_code_verifier is null or char_length(p_code_verifier) not between 43 and 128 then
    return;
  end if;

  select * into v_row
    from public.mcp_oauth_codes c
   where c.code_hash = encode(extensions.digest(p_code, 'sha256'), 'hex')
     and c.used_at is null
     and c.expires_at > now();

  if not found then
    return;
  end if;

  -- Validate redirect_uri matches exactly
  if v_row.redirect_uri <> p_redirect_uri then
    return;
  end if;

  -- Verify PKCE S256: code_challenge == BASE64URL(SHA256(ASCII(code_verifier)))
  v_computed_challenge := public.mcp_base64url(
    extensions.digest(convert_to(p_code_verifier, 'utf8'), 'sha256')
  );
  if v_computed_challenge <> v_row.code_challenge then
    return;
  end if;

  -- Mark code as used immediately (single-use constraint)
  update public.mcp_oauth_codes
     set used_at = now()
   where id = v_row.id;

  -- Generate persistent OAuth access token with prefix mest_oa_
  v_token := 'mest_oa_' || public.mcp_base64url(extensions.gen_random_bytes(32));
  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  v_name := left(coalesce(nullif(btrim(v_row.client_id), ''), 'Claude.ai') || ' (OAuth)', 60);

  -- Auto-revoke previous OAuth key with the same name for this user to avoid limit bloat
  update public.mcp_api_keys
     set revoked_at = now()
   where user_id = v_row.user_id
     and name = v_name
     and revoked_at is null;

  insert into public.mcp_api_keys (
    user_id,
    name,
    key_prefix,
    key_hash,
    scopes,
    expires_at
  ) values (
    v_row.user_id,
    v_name,
    left(v_token, 15),
    v_token_hash,
    v_row.scopes,
    now() + interval '365 days'
  );

  return query select
    v_token,
    'Bearer'::text,
    31536000::integer,
    array_to_string(v_row.scopes, ' ')::text;
end;
$$;
revoke all on function public.exchange_mcp_oauth_code(text, text, text, text) from public;
grant execute on function public.exchange_mcp_oauth_code(text, text, text, text) to anon, authenticated;

-- Update exchange_mcp_api_key to accept both mest_pat_ and mest_oa_ tokens
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
  if p_key is null or p_key !~ '^mest_(pat|oa)_[A-Za-z0-9_-]{43}$' then
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
