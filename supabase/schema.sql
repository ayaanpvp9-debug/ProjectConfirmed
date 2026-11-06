-- ============================================================================
-- ACADEMIA — Supabase schema
-- Run this in the Supabase SQL Editor (or `supabase db push`) before seeding.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 0. Shared helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Profiles (one row per authenticated student)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      text        not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  email         text        not null,
  phone         text        not null check (phone ~ '^\+?[0-9]{10,15}$'),
  display_name  text,
  class_level   smallint    check (class_level between 1 and 12),
  accent        text        not null default 'aurora',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- case-insensitive uniqueness without needing citext
  username_lower text generated always as (lower(username)) stored,
  email_lower    text generated always as (lower(email)) stored
);

create unique index if not exists profiles_username_lower_key on public.profiles (username_lower);
create unique index if not exists profiles_email_lower_key    on public.profiles (email_lower);
create unique index if not exists profiles_phone_key          on public.profiles (phone);

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own" on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. Activity feed (drives "Recent activity" and notification centre)
-- ---------------------------------------------------------------------------
create table if not exists public.activity_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('homework','homework_done','session','session_done','test','account','study')),
  title      text not null,
  detail     text,
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_events_user_created_idx
  on public.activity_events (user_id, created_at desc);

alter table public.activity_events enable row level security;

drop policy if exists "activity: read own" on public.activity_events;
create policy "activity: read own" on public.activity_events
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "activity: insert own" on public.activity_events;
create policy "activity: insert own" on public.activity_events
  for insert to authenticated with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. Homework manager
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.homework_priority as enum ('low','medium','high');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.homework_status as enum ('pending','completed');
exception when duplicate_object then null; end $$;

create table if not exists public.homework (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 1 and 140),
  description  text check (char_length(description) <= 1200),
  subject      text not null check (char_length(subject) between 1 and 40),
  deadline     timestamptz not null,
  priority     public.homework_priority not null default 'medium',
  status       public.homework_status   not null default 'pending',
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists homework_user_deadline_idx on public.homework (user_id, deadline);
create index if not exists homework_user_status_idx   on public.homework (user_id, status);

drop trigger if exists homework_updated_at on public.homework;
create trigger homework_updated_at before update on public.homework
  for each row execute function public.set_updated_at();

-- keep completed_at honest + write the activity feed entry
create or replace function public.homework_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    new.completed_at := coalesce(new.completed_at, now());
    insert into public.activity_events (user_id, kind, title, detail, meta)
    values (new.user_id, 'homework_done', 'Completed “' || new.title || '”', new.subject,
            jsonb_build_object('homework_id', new.id));
  elsif new.status = 'pending' then
    new.completed_at := null;
  end if;

  if tg_op = 'INSERT' then
    insert into public.activity_events (user_id, kind, title, detail, meta)
    values (new.user_id, 'homework', 'New assignment added', new.title,
            jsonb_build_object('homework_id', new.id));
  end if;

  return new;
end;
$$;

drop trigger if exists homework_activity on public.homework;
create trigger homework_activity before insert or update on public.homework
  for each row execute function public.homework_after_change();

alter table public.homework enable row level security;

drop policy if exists "homework: read own" on public.homework;
create policy "homework: read own" on public.homework
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "homework: insert own" on public.homework;
create policy "homework: insert own" on public.homework
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "homework: update own" on public.homework;
create policy "homework: update own" on public.homework
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "homework: delete own" on public.homework;
create policy "homework: delete own" on public.homework
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. Study planner
-- ---------------------------------------------------------------------------
create table if not exists public.study_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  title         text not null check (char_length(btrim(title)) between 1 and 140),
  subject       text not null check (char_length(subject) between 1 and 40),
  scheduled_at  timestamptz not null,
  duration      smallint not null default 45 check (duration between 5 and 600),
  notes         text check (char_length(notes) <= 1200),
  completed     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists study_sessions_user_scheduled_idx
  on public.study_sessions (user_id, scheduled_at);

drop trigger if exists study_sessions_updated_at on public.study_sessions;
create trigger study_sessions_updated_at before update on public.study_sessions
  for each row execute function public.set_updated_at();

create or replace function public.study_session_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activity_events (user_id, kind, title, detail, meta)
    values (new.user_id, 'session', 'Study session planned', new.title,
            jsonb_build_object('session_id', new.id));
  elsif new.completed and old.completed is distinct from true then
    insert into public.activity_events (user_id, kind, title, detail, meta)
    values (new.user_id, 'session_done', 'Study session completed', new.title,
            jsonb_build_object('session_id', new.id));
  end if;
  return new;
end;
$$;

drop trigger if exists study_session_activity on public.study_sessions;
create trigger study_session_activity after insert or update on public.study_sessions
  for each row execute function public.study_session_after_change();

alter table public.study_sessions enable row level security;

drop policy if exists "sessions: read own" on public.study_sessions;
create policy "sessions: read own" on public.study_sessions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "sessions: insert own" on public.study_sessions;
create policy "sessions: insert own" on public.study_sessions
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "sessions: update own" on public.study_sessions;
create policy "sessions: update own" on public.study_sessions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "sessions: delete own" on public.study_sessions;
create policy "sessions: delete own" on public.study_sessions
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. NCERT library (class-wise, official links only)
-- ---------------------------------------------------------------------------
create table if not exists public.ncert_classes (
  id           serial primary key,
  class_number smallint not null unique check (class_number between 1 and 12),
  display_name text not null,
  tagline      text,
  accent       text not null default 'blue'
);

create table if not exists public.ncert_books (
  id           serial primary key,
  class_id     integer not null references public.ncert_classes (id) on delete cascade,
  title        text not null,
  subject      text not null,
  language     text not null default 'English',
  book_code    text,
  official_url text not null check (official_url like 'https://ncert.nic.in/%'),
  download_url text check (download_url is null or download_url like 'https://ncert.nic.in/%'),
  display_order smallint not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists ncert_books_class_idx on public.ncert_books (class_id, display_order);

alter table public.ncert_classes enable row level security;
alter table public.ncert_books   enable row level security;

-- Reference data: readable by any signed-in student, writable only by service role.
drop policy if exists "ncert classes: read" on public.ncert_classes;
create policy "ncert classes: read" on public.ncert_classes
  for select to authenticated using (true);

drop policy if exists "ncert books: read" on public.ncert_books;
create policy "ncert books: read" on public.ncert_books
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 6. Mock tests — exactly five subjects, answer keys locked down
-- ---------------------------------------------------------------------------
create table if not exists public.mock_subjects (
  id            serial primary key,
  name          text not null unique,
  slug          text not null unique,
  description   text,
  accent        text not null default 'blue',
  display_order smallint not null default 0
);

create table if not exists public.mock_tests (
  id               uuid primary key default gen_random_uuid(),
  subject_id       integer not null references public.mock_subjects (id) on delete cascade,
  title            text not null,
  description      text,
  duration_minutes smallint not null default 15 check (duration_minutes between 3 and 180),
  difficulty       text not null default 'moderate' check (difficulty in ('easy','moderate','challenging')),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

create index if not exists mock_tests_subject_idx on public.mock_tests (subject_id) where is_active;

create table if not exists public.mock_questions (
  id             uuid primary key default gen_random_uuid(),
  test_id        uuid not null references public.mock_tests (id) on delete cascade,
  question_text  text not null,
  option_a       text not null,
  option_b       text not null,
  option_c       text not null,
  option_d       text not null,
  correct_option char(1) not null check (correct_option in ('A','B','C','D')),
  explanation    text,
  display_order  smallint not null default 0
);

create index if not exists mock_questions_test_idx on public.mock_questions (test_id, display_order);

create table if not exists public.test_attempts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  test_id          uuid not null references public.mock_tests (id) on delete cascade,
  score            smallint not null default 0,
  total_questions  smallint not null default 0,
  correct_count    smallint not null default 0,
  incorrect_count  smallint not null default 0,
  unanswered_count smallint not null default 0,
  status           text not null default 'in_progress' check (status in ('in_progress','completed')),
  started_at       timestamptz not null default now(),
  completed_at     timestamptz,
  duration_seconds integer,
  created_at       timestamptz not null default now()
);

create index if not exists test_attempts_user_idx on public.test_attempts (user_id, started_at desc);
create unique index if not exists test_attempts_one_open_idx
  on public.test_attempts (user_id, test_id) where status = 'in_progress';

create table if not exists public.test_answers (
  id                    uuid primary key default gen_random_uuid(),
  attempt_id            uuid not null references public.test_attempts (id) on delete cascade,
  question_id           uuid not null references public.mock_questions (id) on delete cascade,
  selected_option       char(1) check (selected_option in ('A','B','C','D')),
  is_marked_for_review  boolean not null default false,
  updated_at            timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create index if not exists test_answers_attempt_idx on public.test_answers (attempt_id);

alter table public.mock_subjects  enable row level security;
alter table public.mock_tests     enable row level security;
alter table public.mock_questions enable row level security;
alter table public.test_attempts  enable row level security;
alter table public.test_answers   enable row level security;

drop policy if exists "mock subjects: read" on public.mock_subjects;
create policy "mock subjects: read" on public.mock_subjects
  for select to authenticated using (true);

drop policy if exists "mock tests: read active" on public.mock_tests;
create policy "mock tests: read active" on public.mock_tests
  for select to authenticated using (is_active = true);

-- IMPORTANT: no policies on mock_questions at all → the answer key is only
-- reachable through the `mock-test` Edge Function (service role). Students
-- receive question text via that function, never `correct_option`.
drop policy if exists "mock questions: none" on public.mock_questions;

-- Attempts are created / graded server-side only. Students may read their own.
drop policy if exists "attempts: read own" on public.test_attempts;
create policy "attempts: read own" on public.test_attempts
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "answers: read own" on public.test_answers;
create policy "answers: read own" on public.test_answers
  for select to authenticated using (
    exists (select 1 from public.test_attempts a
            where a.id = test_answers.attempt_id and a.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 7. Secure signup pre-flight: returns booleans only, never account rows
-- ---------------------------------------------------------------------------
create or replace function public.check_signup_availability(
  p_username text,
  p_email    text default null,
  p_phone    text default null
)
returns table (username_available boolean, email_available boolean, phone_available boolean)
language sql
security definer
set search_path = public
as $$
  select
    not exists (select 1 from public.profiles where username_lower = lower(btrim(coalesce(p_username,'')))),
    case when p_email is null then true
         else not exists (select 1 from public.profiles where email_lower = lower(btrim(p_email))) end,
    case when p_phone is null then true
         else not exists (select 1 from public.profiles where phone = btrim(p_phone)) end;
$$;

revoke all on function public.check_signup_availability(text, text, text) from public;
grant execute on function public.check_signup_availability(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Convenience view used by the Performance dashboard
-- ---------------------------------------------------------------------------
create or replace view public.student_test_history
with (security_invoker = true) as
select
  a.id as attempt_id,
  a.user_id,
  a.test_id,
  t.title as test_title,
  t.duration_minutes,
  s.name as subject_name,
  s.slug as subject_slug,
  a.score,
  a.total_questions,
  a.correct_count,
  a.incorrect_count,
  a.unanswered_count,
  a.started_at,
  a.completed_at,
  case when a.total_questions > 0
       then round((a.score::numeric / a.total_questions::numeric) * 100, 1)
       else 0 end as percentage
from public.test_attempts a
join public.mock_tests t   on t.id = a.test_id
join public.mock_subjects s on s.id = t.subject_id
where a.status = 'completed';
