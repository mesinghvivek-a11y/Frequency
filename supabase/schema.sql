-- ============================================================================
-- Frequency — Phase 1 database schema
-- Run this once in your Supabase project: Dashboard → SQL Editor → paste → Run
-- ============================================================================

-- People. One row per user. Supabase Auth (anonymous sign-in) creates the
-- underlying auth.users row for us; this table holds the public profile.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  gender text not null check (gender in ('male', 'female')),
  rating numeric not null default 3.5,
  created_at timestamptz not null default now()
);

-- The waiting room. One row per person currently looking for a match.
create table queue (
  user_id uuid primary key references profiles(id) on delete cascade,
  gender text not null,
  gender_filter text not null default 'any',
  joined_at timestamptz not null default now()
);

-- A pairing between two people.
create table chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references profiles(id) on delete cascade,
  user_b uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

-- Messages within a session.
create table messages (
  id bigint generated always as identity primary key,
  session_id uuid not null references chat_sessions(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- find_match: the core pairing logic, done as one atomic database operation
-- so two people can never both claim the same match at once.
-- ----------------------------------------------------------------------------
create or replace function find_match(p_gender text, p_gender_filter text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_match record;
  v_session_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- clear any stale queue entry for this user first
  delete from queue where user_id = v_uid;

  -- look for a compatible waiting partner; SKIP LOCKED means two people
  -- calling this at the same instant can never grab the same row
  select * into v_match
  from queue
  where user_id <> v_uid
    and (gender_filter = 'any' or gender_filter = p_gender)
    and (p_gender_filter = 'any' or p_gender_filter = gender)
  order by joined_at asc
  limit 1
  for update skip locked;

  if found then
    delete from queue where user_id = v_match.user_id;
    insert into chat_sessions (user_a, user_b) values (v_uid, v_match.user_id)
    returning id into v_session_id;
    return v_session_id;
  else
    insert into queue (user_id, gender, gender_filter)
    values (v_uid, p_gender, p_gender_filter)
    on conflict (user_id) do update set gender_filter = excluded.gender_filter, joined_at = now();
    return null;
  end if;
end;
$$;

-- leave_queue: called when someone gives up waiting or closes the tab
create or replace function leave_queue()
returns void
language sql
security definer
set search_path = public
as $$
  delete from queue where user_id = auth.uid();
$$;

-- end_session: marks a chat as over so both sides know to stop
create or replace function end_session(p_session_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update chat_sessions set ended_at = now()
  where id = p_session_id and (user_a = auth.uid() or user_b = auth.uid());
$$;

-- ----------------------------------------------------------------------------
-- Row Level Security — locks down who can read/write what.
-- Without this, anyone with your public API key could read every table directly.
-- ----------------------------------------------------------------------------
alter table profiles enable row level security;
alter table queue enable row level security;
alter table chat_sessions enable row level security;
alter table messages enable row level security;

create policy "profiles are publicly readable" on profiles
  for select using (true);
create policy "users can create their own profile" on profiles
  for insert with check (auth.uid() = id);
create policy "users can update their own profile" on profiles
  for update using (auth.uid() = id);

-- queue rows are only ever touched via the functions above (security definer),
-- so no direct client policies are needed — deny-by-default is correct here.

create policy "participants can see their own sessions" on chat_sessions
  for select using (auth.uid() = user_a or auth.uid() = user_b);

create policy "participants can read session messages" on messages
  for select using (
    exists (
      select 1 from chat_sessions
      where chat_sessions.id = messages.session_id
      and (chat_sessions.user_a = auth.uid() or chat_sessions.user_b = auth.uid())
    )
  );
create policy "participants can send session messages" on messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from chat_sessions
      where chat_sessions.id = messages.session_id
      and (chat_sessions.user_a = auth.uid() or chat_sessions.user_b = auth.uid())
      and chat_sessions.ended_at is null
    )
  );

-- Enable realtime (live updates) on the tables the app subscribes to
alter publication supabase_realtime add table chat_sessions;
alter publication supabase_realtime add table messages;
