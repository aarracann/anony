-- ==============================================================================
-- ANONY DATABASE MIGRATION: Core Schema, RLS, Functions & Realtime
-- ==============================================================================

-- 1. PROFILES TABLE
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (
    char_length(username) between 3 and 30 and
    username ~ '^[a-z0-9_-]+$'
  ),
  push_token text null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Index for speedy username lookups
create index if not exists idx_profiles_username on public.profiles(username);

-- Public view exposing only safe profile columns (no push_token exposure)
create or replace view public.public_profiles as
  select id, username, created_at
  from public.profiles;

-- Grant permissions on public_profiles
grant select on public.public_profiles to anon, authenticated;

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- Profiles RLS:
-- Anyone can view usernames/profiles
create policy "Anyone can view profile basic data"
  on public.profiles
  for select
  using (true);

-- Users can only update their own profile
create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Users can delete their own profile
create policy "Users can delete own profile"
  on public.profiles
  for delete
  to authenticated
  using (auth.uid() = id);


-- 2. MESSAGES TABLE
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  is_read boolean default false not null,
  created_at timestamptz default now() not null
);

-- Index on messages (recipient_id, created_at desc) for ultra-fast inbox queries
create index if not exists idx_messages_recipient_created_desc
  on public.messages(recipient_id, created_at desc);

-- Enable RLS on messages
alter table public.messages enable row level security;

-- Messages RLS:
-- Owners can SELECT their own messages
create policy "Owners can view received messages"
  on public.messages
  for select
  to authenticated
  using (auth.uid() = recipient_id);

-- Owners can UPDATE their own messages (is_read only via trigger)
create policy "Owners can update received messages"
  on public.messages
  for update
  to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- Owners can DELETE their own messages
create policy "Owners can delete received messages"
  on public.messages
  for delete
  to authenticated
  using (auth.uid() = recipient_id);

-- Trigger: Ensure owners can ONLY update `is_read` column and cannot tamper with message body or recipient
create or replace function public.check_message_update()
returns trigger as $$
begin
  if old.recipient_id is distinct from new.recipient_id or
     old.body is distinct from new.body or
     old.created_at is distinct from new.created_at or
     old.id is distinct from new.id then
    raise exception 'Only is_read field can be updated';
  end if;
  return new;
end;
$$ language plpgsql;

create or replace trigger tr_check_message_update
  before update on public.messages
  for each row execute function public.check_message_update();

-- NOTE: NO INSERT policy for anon or authenticated roles on messages.
-- Inserts must only happen through the Edge Function / backend using the service_role key.


-- 3. MESSAGE_META TABLE (Sender-identifying data lives ONLY here)
create table if not exists public.message_meta (
  message_id uuid primary key references public.messages(id) on delete cascade,
  device_hash text not null,
  ip_hash text not null,
  created_at timestamptz default now() not null
);

-- Index for device & ip lookup
create index if not exists idx_message_meta_device on public.message_meta(device_hash);
create index if not exists idx_message_meta_ip on public.message_meta(ip_hash);

-- Enable RLS on message_meta: ZERO CLIENT ACCESS
alter table public.message_meta enable row level security;


-- 4. RATE_LIMITS TABLE
create table if not exists public.rate_limits (
  id bigint generated always as identity primary key,
  key text not null,
  created_at timestamptz default now() not null
);

-- Index on (key, created_at) as required
create index if not exists idx_rate_limits_key_created_at
  on public.rate_limits(key, created_at);

-- Enable RLS on rate_limits: ZERO CLIENT ACCESS
alter table public.rate_limits enable row level security;


-- 5. BLOCKED_DEVICES TABLE
create table if not exists public.blocked_devices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete cascade, -- null = global block, specific uuid = per-owner block
  device_hash text not null,
  reason text null,
  created_at timestamptz default now() not null,
  constraint uq_blocked_owner_device unique nulls not distinct (owner_id, device_hash)
);

create index if not exists idx_blocked_devices_lookup
  on public.blocked_devices(device_hash, owner_id);

-- Enable RLS on blocked_devices: ZERO DIRECT CLIENT ACCESS
alter table public.blocked_devices enable row level security;


-- 6. REPORTS TABLE
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  reporter_id uuid references auth.users(id) on delete set null,
  reason text not null,
  created_at timestamptz default now() not null
);

create index if not exists idx_reports_message on public.reports(message_id);

-- Enable RLS on reports
alter table public.reports enable row level security;

-- Authenticated recipients can submit reports for messages they own
create policy "Authenticated users can submit reports"
  on public.reports
  for insert
  to authenticated
  with check (
    auth.uid() = reporter_id and
    exists (
      select 1 from public.messages m
      where m.id = message_id and m.recipient_id = auth.uid()
    )
  );

create policy "Users can view own submitted reports"
  on public.reports
  for select
  to authenticated
  using (auth.uid() = reporter_id);


-- 7. SECURE RPC FUNCTION: Owner-initiated device block
-- Allows message recipient to block the sender's device without exposing device_hash to the client!
create or replace function public.block_sender_by_message_id(
  p_message_id uuid,
  p_reason text default 'Blocked by recipient'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient_id uuid;
  v_device_hash text;
begin
  -- 1. Verify caller owns the message
  select recipient_id into v_recipient_id
  from public.messages
  where id = p_message_id;

  if v_recipient_id is null or v_recipient_id != auth.uid() then
    raise exception 'Unauthorized: Message not found or not owned by caller';
  end if;

  -- 2. Lookup device_hash from message_meta
  select device_hash into v_device_hash
  from public.message_meta
  where message_id = p_message_id;

  if v_device_hash is null then
    raise exception 'Sender metadata not found for message';
  end if;

  -- 3. Insert into blocked_devices under this recipient
  insert into public.blocked_devices (owner_id, device_hash, reason, created_at)
  values (v_recipient_id, v_device_hash, p_reason, now())
  on conflict (owner_id, device_hash) do update
  set reason = excluded.reason;

  return true;
end;
$$;

grant execute on function public.block_sender_by_message_id(uuid, text) to authenticated;


-- 8. AUTH TRIGGER: Auto-create profile on auth.users signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_username text;
  clean_username text;
  temp_username text;
  counter integer := 0;
begin
  -- Try to extract preferred username from user metadata
  chosen_username := new.raw_user_meta_data->>'username';

  if chosen_username is null or trim(chosen_username) = '' then
    -- Fallback to local part of email
    chosen_username := split_part(coalesce(new.email, 'user'), '@', 1);
  end if;

  -- Normalize to lowercase alphanumeric + hyphens/underscores
  clean_username := lower(regexp_replace(chosen_username, '[^a-zA-Z0-9_-]', '', 'g'));
  if char_length(clean_username) < 3 then
    clean_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  clean_username := substr(clean_username, 1, 20);

  temp_username := clean_username;

  -- Ensure unique username
  while exists (select 1 from public.profiles where username = temp_username) loop
    counter := counter + 1;
    temp_username := substr(clean_username, 1, 15) || '_' || counter;
  end if;

  insert into public.profiles (id, username, created_at, updated_at)
  values (new.id, temp_username, now(), now())
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Drop trigger if exists and recreate
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- 9. REALTIME: Enable replication for messages
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
