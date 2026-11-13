-- POLITIQUE — core schema
-- Postgres 17 / Supabase. Apply with `supabase db push` or the Supabase MCP apply_migration.
-- Everything lives in its own `politique` schema so it can share a Supabase project
-- with another app and be moved out later (pg_dump --schema=politique).
-- Nothing is attached to auth.users: a person joins POLITIQUE through politique.join_politique().
-- Conventions: RLS on everything, counters kept by triggers,
-- anything touching the PRIVATE voting location goes through SECURITY DEFINER
-- functions that only ever return aggregates or the caller's own row.

create schema if not exists politique;
create schema if not exists extensions;
create extension if not exists citext with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
-- Extensions that were already installed elsewhere stay where they are; public stays on the path for that.
set search_path = politique, extensions, public;

-- unaccent() is STABLE; generated columns need IMMUTABLE.
create or replace function f_unaccent(t text) returns text
language plpgsql immutable parallel safe strict set search_path = politique, extensions, public as $$
begin return unaccent(t); end $$;
-- plpgsql (not sql) so the search_path above is honoured wherever unaccent was installed.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type account_type as enum ('citoyen', 'elu', 'institution', 'media');
create type mandate_type as enum (
  'president', 'ministre', 'depute', 'senateur', 'maire',
  'president_conseil_regional', 'gouverneur_district',
  'conseiller_municipal', 'conseiller_regional', 'autre'
);
create type post_kind as enum ('post', 'reply', 'quote');
create type post_visibility as enum ('public', 'followers');
create type notification_type as enum (
  'like', 'reply', 'repost', 'quote', 'follow', 'mention', 'poll_end',
  'interpellation_answer', 'official_post', 'verification', 'moderation', 'message'
);
create type report_reason as enum (
  'haine', 'harcelement', 'desinformation', 'spam', 'violence', 'usurpation', 'contenu_adulte', 'autre'
);
create type report_status as enum ('open', 'reviewing', 'actioned', 'dismissed');
create type moderation_action_type as enum (
  'hide_post', 'delete_post', 'warn', 'suspend', 'ban', 'unban', 'verify', 'unverify', 'label', 'dismiss'
);
create type verification_status as enum ('pending', 'approved', 'rejected');
create type interpellation_status as enum ('ouverte', 'repondue', 'classee');
create type promise_status as enum ('annoncee', 'en_cours', 'tenue', 'partiellement_tenue', 'non_tenue');
create type permanence_status as enum ('planifiee', 'en_cours', 'terminee', 'annulee');
create type proposition_status as enum ('nouvelle', 'etudiee', 'adoptee', 'refusee');
create type post_label_type as enum ('contexte', 'contestee', 'fausse', 'satire', 'officiel');

-- ---------------------------------------------------------------------------
-- Geography of Côte d'Ivoire (districts > regions > departments > communes)
-- Seeded by seed/ci_geo.sql. Public read, admin write.
-- ---------------------------------------------------------------------------
create table ci_regions (
  id          smallint primary key,
  district    text not null,
  name        text not null,
  slug        text not null unique,
  is_autonomous_district boolean not null default false
);
create table ci_departments (
  id          smallint primary key,
  region_id   smallint not null references ci_regions(id),
  name        text not null,
  slug        text not null unique
);
create table ci_communes (
  id            smallint primary key,
  department_id smallint not null references ci_departments(id),
  name          text not null,
  slug          text not null unique
);
create index on ci_departments(region_id);
create index on ci_communes(department_id);

-- ---------------------------------------------------------------------------
-- Profiles (public) and private_profiles (never public)
-- ---------------------------------------------------------------------------
create table profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  handle           citext not null unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name     text not null check (char_length(display_name) between 1 and 50),
  bio              text check (char_length(bio) <= 240),
  avatar_url       text,
  banner_url       text,
  website          text,
  account_type     account_type not null default 'citoyen',
  verified         boolean not null default false,
  verified_at      timestamptz,
  lang             text not null default 'fr' check (lang in ('fr', 'en')),
  theme            text not null default 'system' check (theme in ('system', 'light', 'dark')),
  low_data         boolean not null default false,
  -- public, opt-in: the commune a person chooses to display (not where they vote)
  shown_commune_id smallint references ci_communes(id),
  followers_count  integer not null default 0,
  following_count  integer not null default 0,
  posts_count      integer not null default 0,
  is_admin         boolean not null default false,
  is_moderator     boolean not null default false,
  suspended_until  timestamptz,
  onboarded_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
create index profiles_display_name_trgm on profiles using gin (display_name gin_trgm_ops);
create index profiles_handle_trgm on profiles using gin ((handle::text) gin_trgm_ops);

-- Where the person votes. Required at sign-up, PRIVATE: only the owner reads it,
-- and the only other access is through aggregate functions below.
create table private_profiles (
  user_id            uuid primary key references profiles(id) on delete cascade,
  vote_region_id     smallint references ci_regions(id),
  vote_department_id smallint references ci_departments(id),
  vote_commune_id    smallint references ci_communes(id),
  vote_locality      text,                      -- quartier / village, free text
  is_registered_voter boolean,                   -- self-declared, not verified
  phone              text,
  birth_year         smallint check (birth_year between 1900 and 2100),
  updated_at         timestamptz not null default now()
);
create index on private_profiles(vote_commune_id);
create index on private_profiles(vote_department_id);
create index on private_profiles(vote_region_id);

-- ---------------------------------------------------------------------------
-- Officials: the political class. One row per mandate; a row may be claimed by
-- a profile (verified account) or exist unclaimed so citizens can still address it.
-- ---------------------------------------------------------------------------
create table officials (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid references profiles(id) on delete set null,
  full_name     text not null,
  mandate       mandate_type not null,
  title         text,                        -- "Député de Cocody", "Maire de Bouaké"
  party         text,
  region_id     smallint references ci_regions(id),
  department_id smallint references ci_departments(id),
  commune_id    smallint references ci_communes(id),
  circonscription text,
  term_start    date,
  term_end      date,
  photo_url     text,
  bio           text,
  claimed_at    timestamptz,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on officials(profile_id);
create index on officials(commune_id);
create index on officials(department_id);
create index on officials(region_id);
create index on officials(mandate);
create index officials_name_trgm on officials using gin (full_name gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Social graph
-- ---------------------------------------------------------------------------
create table follows (
  follower_id uuid not null references profiles(id) on delete cascade,
  followee_id uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index on follows(followee_id);

create table blocks (
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
create table mutes (
  muter_id uuid not null references profiles(id) on delete cascade,
  muted_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id)
);

-- ---------------------------------------------------------------------------
-- Posts, polls, reactions
-- ---------------------------------------------------------------------------
create table posts (
  id             uuid primary key default gen_random_uuid(),
  author_id      uuid not null references profiles(id) on delete cascade,
  kind           post_kind not null default 'post',
  text           text not null default '' check (char_length(text) <= 1000),
  lang           text not null default 'fr',
  parent_id      uuid references posts(id) on delete cascade,   -- reply to
  root_id        uuid references posts(id) on delete cascade,   -- top of the thread
  quoted_id      uuid references posts(id) on delete set null,  -- quote post
  visibility     post_visibility not null default 'public',
  media          jsonb not null default '[]'::jsonb,            -- [{type,url,alt,width,height,duration,poster}]
  commune_id     smallint references ci_communes(id),           -- public, opt-in location tag
  hashtags       text[] not null default '{}',
  mentions       uuid[] not null default '{}',
  reply_count    integer not null default 0,
  like_count     integer not null default 0,
  repost_count   integer not null default 0,
  quote_count    integer not null default 0,
  bookmark_count integer not null default 0,
  view_count     integer not null default 0,
  is_pinned      boolean not null default false,
  is_hidden      boolean not null default false,                -- moderation
  search         tsvector generated always as (to_tsvector('french', f_unaccent(text))) stored,
  created_at     timestamptz not null default now(),
  edited_at      timestamptz,
  deleted_at     timestamptz,
  check ((kind = 'reply') = (parent_id is not null)),
  check ((kind = 'quote') = (quoted_id is not null))
);
create index on posts(author_id, created_at desc);
create index on posts(parent_id, created_at);
create index on posts(root_id);
create index on posts(created_at desc) where deleted_at is null and is_hidden = false and kind <> 'reply';
create index on posts using gin(hashtags);
create index on posts using gin(search);
create index on posts(commune_id, created_at desc) where commune_id is not null;

create table polls (
  post_id     uuid primary key references posts(id) on delete cascade,
  options     jsonb not null,                 -- ["Routes", "Écoles", ...] (2..4)
  ends_at     timestamptz not null,
  votes_count integer not null default 0,
  counts      integer[] not null default '{0,0,0,0}',
  check (jsonb_array_length(options) between 2 and 4)
);
create table poll_votes (
  post_id    uuid not null references polls(post_id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  option_idx smallint not null check (option_idx between 0 and 3),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table likes (
  user_id    uuid not null references profiles(id) on delete cascade,
  post_id    uuid not null references posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index on likes(post_id);

create table reposts (
  user_id    uuid not null references profiles(id) on delete cascade,
  post_id    uuid not null references posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index on reposts(post_id);
create index on reposts(user_id, created_at desc);

create table bookmarks (
  user_id    uuid not null references profiles(id) on delete cascade,
  post_id    uuid not null references posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table hashtags (
  tag          citext primary key,
  posts_count  integer not null default 0,
  last_used_at timestamptz not null default now()
);
create table post_hashtags (
  post_id    uuid not null references posts(id) on delete cascade,
  tag        citext not null references hashtags(tag) on delete cascade,
  commune_id smallint references ci_communes(id),
  created_at timestamptz not null default now(),
  primary key (post_id, tag)
);
create index on post_hashtags(tag, created_at desc);
create index on post_hashtags(commune_id, created_at desc) where commune_id is not null;

-- Labels put on a post by a moderator or a verified media account
-- ("Contexte", "Contestée", "Fausse", "Satire", "Officiel").
create table post_labels (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references posts(id) on delete cascade,
  label       post_label_type not null,
  note        text check (char_length(note) <= 500),
  source_url  text,
  labeled_by  uuid not null references profiles(id),
  created_at  timestamptz not null default now()
);
create index on post_labels(post_id);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  actor_id   uuid references profiles(id) on delete cascade,
  type       notification_type not null,
  post_id    uuid references posts(id) on delete cascade,
  ref_id     uuid,                     -- interpellation / conversation / etc.
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index on notifications(user_id, created_at desc);
create index on notifications(user_id) where read_at is null;

-- ---------------------------------------------------------------------------
-- Direct messages
-- ---------------------------------------------------------------------------
create table conversations (
  id              uuid primary key default gen_random_uuid(),
  is_group        boolean not null default false,
  title           text,
  created_by      uuid references profiles(id),
  last_message_at timestamptz,
  created_at      timestamptz not null default now()
);
create table conversation_members (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  last_read_at    timestamptz,
  muted           boolean not null default false,
  joined_at       timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index on conversation_members(user_id);
create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id       uuid not null references profiles(id) on delete cascade,
  text            text not null default '' check (char_length(text) <= 4000),
  media           jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create index on messages(conversation_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Moderation
-- ---------------------------------------------------------------------------
create table reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id) on delete cascade,
  post_id     uuid references posts(id) on delete cascade,
  profile_id  uuid references profiles(id) on delete cascade,
  message_id  uuid references messages(id) on delete cascade,
  reason      report_reason not null,
  details     text check (char_length(details) <= 1000),
  status      report_status not null default 'open',
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at  timestamptz not null default now(),
  check (num_nonnulls(post_id, profile_id, message_id) = 1)
);
create index on reports(status, created_at);

create table moderation_actions (
  id             uuid primary key default gen_random_uuid(),
  moderator_id   uuid not null references profiles(id),
  target_user_id uuid references profiles(id) on delete cascade,
  post_id        uuid references posts(id) on delete cascade,
  report_id      uuid references reports(id) on delete set null,
  action         moderation_action_type not null,
  reason         text,
  expires_at     timestamptz,
  created_at     timestamptz not null default now()
);
create index on moderation_actions(target_user_id, created_at desc);

create table verification_requests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references profiles(id) on delete cascade,
  requested_type account_type not null check (requested_type <> 'citoyen'),
  full_name      text not null,
  official_id    uuid references officials(id),
  organisation   text,
  document_path  text,            -- storage path in private bucket "documents"
  proof_path     text,
  status         verification_status not null default 'pending',
  reviewed_by    uuid references profiles(id),
  notes          text,
  created_at     timestamptz not null default now(),
  reviewed_at    timestamptz
);
create index on verification_requests(status, created_at);

-- ---------------------------------------------------------------------------
-- Ivorian-specific: Interpellations (public questions to an official)
-- ---------------------------------------------------------------------------
create table interpellations (
  id             uuid primary key default gen_random_uuid(),
  author_id      uuid not null references profiles(id) on delete cascade,
  official_id    uuid not null references officials(id) on delete cascade,
  post_id        uuid references posts(id) on delete set null,   -- the public post carrying the question
  title          text not null check (char_length(title) between 5 and 140),
  body           text check (char_length(body) <= 2000),
  upvotes_count  integer not null default 0,
  status         interpellation_status not null default 'ouverte',
  answer_post_id uuid references posts(id) on delete set null,
  answered_at    timestamptz,
  created_at     timestamptz not null default now()
);
create index on interpellations(official_id, status, upvotes_count desc);
create index on interpellations(author_id);
create table interpellation_votes (
  interpellation_id uuid not null references interpellations(id) on delete cascade,
  user_id           uuid not null references profiles(id) on delete cascade,
  created_at        timestamptz not null default now(),
  primary key (interpellation_id, user_id)
);

-- Promise tracker ("Promesses")
create table promises (
  id           uuid primary key default gen_random_uuid(),
  official_id  uuid not null references officials(id) on delete cascade,
  title        text not null check (char_length(title) between 5 and 200),
  description  text check (char_length(description) <= 2000),
  source_url   text,
  made_at      date,
  due_at       date,
  status       promise_status not null default 'annoncee',
  status_note  text,
  created_by   uuid not null references profiles(id),
  verified_by  uuid references profiles(id),       -- moderator or verified media
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on promises(official_id, status);
create table promise_updates (
  id          uuid primary key default gen_random_uuid(),
  promise_id  uuid not null references promises(id) on delete cascade,
  author_id   uuid not null references profiles(id) on delete cascade,
  new_status  promise_status,
  text        text not null check (char_length(text) <= 1000),
  source_url  text,
  created_at  timestamptz not null default now()
);
create index on promise_updates(promise_id, created_at desc);

-- Digital surgery ("Permanence numérique"): a scheduled live Q&A by an official
create table permanences (
  id          uuid primary key default gen_random_uuid(),
  official_id uuid not null references officials(id) on delete cascade,
  host_id     uuid not null references profiles(id) on delete cascade,
  title       text not null check (char_length(title) <= 140),
  description text,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  status      permanence_status not null default 'planifiee',
  post_id     uuid references posts(id) on delete set null,   -- anchor post; questions are replies
  created_at  timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index on permanences(official_id, starts_at desc);
create index on permanences(starts_at) where status in ('planifiee', 'en_cours');

-- Commune barometer: a monthly question, results shown per commune of VOTE
-- (private data) only as aggregates above a minimum threshold.
create table barometers (
  id         uuid primary key default gen_random_uuid(),
  month      date not null,                     -- first day of the month
  question   text not null,
  options    jsonb not null check (jsonb_array_length(options) between 2 and 6),
  opens_at   timestamptz not null default now(),
  closes_at  timestamptz not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create unique index on barometers(month);
create table barometer_votes (
  barometer_id uuid not null references barometers(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  option_idx   smallint not null check (option_idx between 0 and 5),
  created_at   timestamptz not null default now(),
  primary key (barometer_id, user_id)
);

-- Idea box ("Boîte à idées"): citizen proposals for a commune, voted, answered by officials
create table propositions (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references profiles(id) on delete cascade,
  commune_id  smallint not null references ci_communes(id),
  title       text not null check (char_length(title) between 5 and 140),
  body        text not null check (char_length(body) <= 2000),
  votes_count integer not null default 0,
  status      proposition_status not null default 'nouvelle',
  response_post_id uuid references posts(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index on propositions(commune_id, votes_count desc);
create table proposition_votes (
  proposition_id uuid not null references propositions(id) on delete cascade,
  user_id        uuid not null references profiles(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (proposition_id, user_id)
);

-- Waitlist (pre-launch site) — kept in Postgres too so the beta invite list is one query away.
create table waitlist (
  email      citext primary key,
  role       text,
  lang       text,
  invited_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = politique, extensions, public as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false)
$$;
create or replace function is_moderator() returns boolean
language sql stable security definer set search_path = politique, extensions, public as $$
  select coalesce((select is_admin or is_moderator from profiles where id = auth.uid()), false)
$$;
create or replace function is_verified_media() returns boolean
language sql stable security definer set search_path = politique, extensions, public as $$
  select coalesce((select verified and account_type = 'media' from profiles where id = auth.uid()), false)
$$;
create or replace function is_suspended(uid uuid) returns boolean
language sql stable security definer set search_path = politique, extensions, public as $$
  select coalesce((select suspended_until > now() from profiles where id = uid), false)
$$;
create or replace function is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = politique, extensions, public as $$
  select exists (
    select 1 from blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  )
$$;
create or replace function follows_user(follower uuid, followee uuid) returns boolean
language sql stable security definer set search_path = politique, extensions, public as $$
  select exists (select 1 from follows where follower_id = follower and followee_id = followee)
$$;

create or replace function is_conversation_member(cid uuid) returns boolean
language sql stable security definer set search_path = politique, extensions, public as $$
  select exists (select 1 from conversation_members m where m.conversation_id = cid and m.user_id = auth.uid())
$$;
create or replace function post_author(pid uuid) returns uuid
language sql stable security definer set search_path = politique, extensions, public as $$
  select author_id from posts where id = pid
$$;

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger profiles_updated before update on profiles for each row execute function set_updated_at();
create trigger private_profiles_updated before update on private_profiles for each row execute function set_updated_at();
create trigger officials_updated before update on officials for each row execute function set_updated_at();
create trigger promises_updated before update on promises for each row execute function set_updated_at();

-- Joining POLITIQUE -> profile + private profile.
-- The auth user list is shared with another app, so nothing fires on auth.users.
-- The app calls join_politique() after sign-in. It reads the sign-up form (meta) or, failing that,
-- the sign-up metadata stored on the auth user when it was tagged app = politique.
-- Does nothing if the caller already has a profile.
create or replace function join_politique(meta jsonb default null) returns boolean
language plpgsql security definer set search_path = politique, extensions, public as $$
declare
  uid uuid := auth.uid();
  u record;
  m jsonb;
  h text;
begin
  if uid is null then return false; end if;
  if exists (select 1 from profiles where id = uid) then return false; end if;
  select id, email, phone, raw_user_meta_data into u from auth.users where id = uid;
  if not found then return false; end if;
  m := coalesce(meta, case when u.raw_user_meta_data->>'app' = 'politique' then u.raw_user_meta_data end, '{}'::jsonb);
  h := lower(coalesce(m->>'handle', ''));
  if h !~ '^[a-z0-9_]{3,20}$' or exists (select 1 from profiles where handle = h) then
    h := 'u' || substr(replace(uid::text, '-', ''), 1, 12);
  end if;
  insert into profiles (id, handle, display_name, lang)
  values (uid, h, left(coalesce(nullif(m->>'display_name', ''), split_part(coalesce(u.email, 'citoyen'), '@', 1)), 50),
          case when m->>'lang' = 'en' then 'en' else 'fr' end);
  insert into private_profiles (user_id, vote_region_id, vote_department_id, vote_commune_id, vote_locality, is_registered_voter, phone)
  values (uid,
          nullif(m->>'vote_region_id', '')::smallint,
          nullif(m->>'vote_department_id', '')::smallint,
          nullif(m->>'vote_commune_id', '')::smallint,
          nullif(m->>'vote_locality', ''),
          case when m ? 'is_registered_voter' then (m->>'is_registered_voter')::boolean else null end,
          u.phone);
  return true;
end $$;

-- Counters -------------------------------------------------------------------
create or replace function trg_follows() returns trigger language plpgsql security definer set search_path = politique, extensions, public as $$
begin
  if tg_op = 'INSERT' then
    update profiles set followers_count = followers_count + 1 where id = new.followee_id;
    update profiles set following_count = following_count + 1 where id = new.follower_id;
    insert into notifications (user_id, actor_id, type) values (new.followee_id, new.follower_id, 'follow');
    return new;
  else
    update profiles set followers_count = greatest(followers_count - 1, 0) where id = old.followee_id;
    update profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
    return old;
  end if;
end $$;
create trigger follows_counts after insert or delete on follows for each row execute function trg_follows();

create or replace function trg_likes() returns trigger language plpgsql security definer set search_path = politique, extensions, public as $$
declare a uuid;
begin
  if tg_op = 'INSERT' then
    update posts set like_count = like_count + 1 where id = new.post_id returning author_id into a;
    if a <> new.user_id then
      insert into notifications (user_id, actor_id, type, post_id) values (a, new.user_id, 'like', new.post_id);
    end if;
    return new;
  else
    update posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
    return old;
  end if;
end $$;
create trigger likes_counts after insert or delete on likes for each row execute function trg_likes();

create or replace function trg_reposts() returns trigger language plpgsql security definer set search_path = politique, extensions, public as $$
declare a uuid;
begin
  if tg_op = 'INSERT' then
    update posts set repost_count = repost_count + 1 where id = new.post_id returning author_id into a;
    if a <> new.user_id then
      insert into notifications (user_id, actor_id, type, post_id) values (a, new.user_id, 'repost', new.post_id);
    end if;
    return new;
  else
    update posts set repost_count = greatest(repost_count - 1, 0) where id = old.post_id;
    return old;
  end if;
end $$;
create trigger reposts_counts after insert or delete on reposts for each row execute function trg_reposts();

create or replace function trg_bookmarks() returns trigger language plpgsql security definer set search_path = politique, extensions, public as $$
begin
  if tg_op = 'INSERT' then
    update posts set bookmark_count = bookmark_count + 1 where id = new.post_id; return new;
  else
    update posts set bookmark_count = greatest(bookmark_count - 1, 0) where id = old.post_id; return old;
  end if;
end $$;
create trigger bookmarks_counts after insert or delete on bookmarks for each row execute function trg_bookmarks();

-- Posts: thread root, counters, hashtags, mentions, notifications, official fan-out
create or replace function trg_posts_before() returns trigger language plpgsql security definer set search_path = politique, extensions, public as $$
declare p posts%rowtype; tags text[]; mentions_arr uuid[];
begin
  if new.parent_id is not null then
    select * into p from posts where id = new.parent_id;
    new.root_id := coalesce(p.root_id, p.id);
  end if;
  -- hashtags: #MotClé (letters, digits, underscore, accents)
  select coalesce(array_agg(distinct lower(m[1])), '{}') into tags
  from regexp_matches(new.text, '(?:^|[^\w])#([[:alnum:]_]{2,50})', 'g') as m;
  new.hashtags := tags;
  -- mentions: @handle
  select coalesce(array_agg(distinct pr.id), '{}') into mentions_arr
  from regexp_matches(new.text, '(?:^|[^\w])@([a-z0-9_]{3,20})', 'gi') as m
  join profiles pr on pr.handle = lower(m[1]);
  new.mentions := mentions_arr;
  return new;
end $$;
create trigger posts_before before insert on posts for each row execute function trg_posts_before();

create or replace function trg_posts_after() returns trigger language plpgsql security definer set search_path = politique, extensions, public as $$
declare t text; m uuid; parent_author uuid; quoted_author uuid; o officials%rowtype;
begin
  if tg_op = 'INSERT' then
    update profiles set posts_count = posts_count + 1 where id = new.author_id;
    if new.parent_id is not null then
      update posts set reply_count = reply_count + 1 where id = new.parent_id returning author_id into parent_author;
      if parent_author <> new.author_id then
        insert into notifications (user_id, actor_id, type, post_id) values (parent_author, new.author_id, 'reply', new.id);
      end if;
    end if;
    if new.quoted_id is not null then
      update posts set quote_count = quote_count + 1 where id = new.quoted_id returning author_id into quoted_author;
      if quoted_author <> new.author_id then
        insert into notifications (user_id, actor_id, type, post_id) values (quoted_author, new.author_id, 'quote', new.id);
      end if;
    end if;
    foreach t in array new.hashtags loop
      insert into hashtags (tag, posts_count, last_used_at) values (t, 1, now())
        on conflict (tag) do update set posts_count = hashtags.posts_count + 1, last_used_at = now();
      insert into post_hashtags (post_id, tag, commune_id) values (new.id, t, new.commune_id) on conflict do nothing;
    end loop;
    foreach m in array new.mentions loop
      if m <> new.author_id then
        insert into notifications (user_id, actor_id, type, post_id) values (m, new.author_id, 'mention', new.id);
      end if;
    end loop;
    -- A verified official's top-level post notifies the people who vote in their
    -- constituency (private match; recipients only ever see "your elected official posted").
    if new.kind = 'post' then
      select * into o from officials where profile_id = new.author_id limit 1;
      if found then
        insert into notifications (user_id, actor_id, type, post_id)
        select pp.user_id, new.author_id, 'official_post'::notification_type, new.id
        from private_profiles pp
        where pp.user_id <> new.author_id
          and ((o.commune_id is not null and pp.vote_commune_id = o.commune_id)
            or (o.commune_id is null and o.department_id is not null and pp.vote_department_id = o.department_id)
            or (o.commune_id is null and o.department_id is null and o.region_id is not null and pp.vote_region_id = o.region_id))
        limit 50000;
      end if;
    end if;
    return new;
  elsif tg_op = 'UPDATE' and new.deleted_at is not null and old.deleted_at is null then
    update profiles set posts_count = greatest(posts_count - 1, 0) where id = new.author_id;
    if new.parent_id is not null then
      update posts set reply_count = greatest(reply_count - 1, 0) where id = new.parent_id;
    end if;
    return new;
  end if;
  return new;
end $$;
create trigger posts_after after insert or update on posts for each row execute function trg_posts_after();

create or replace function trg_poll_votes() returns trigger language plpgsql security definer set search_path = politique, extensions, public as $$
declare c integer[];
begin
  select counts into c from polls where post_id = new.post_id for update;
  c[new.option_idx + 1] := c[new.option_idx + 1] + 1;
  update polls set counts = c, votes_count = votes_count + 1 where post_id = new.post_id;
  return new;
end $$;
create trigger poll_votes_counts after insert on poll_votes for each row execute function trg_poll_votes();

create or replace function trg_interpellation_votes() returns trigger language plpgsql security definer set search_path = politique, extensions, public as $$
begin
  if tg_op = 'INSERT' then
    update interpellations set upvotes_count = upvotes_count + 1 where id = new.interpellation_id; return new;
  else
    update interpellations set upvotes_count = greatest(upvotes_count - 1, 0) where id = old.interpellation_id; return old;
  end if;
end $$;
create trigger interpellation_votes_counts after insert or delete on interpellation_votes for each row execute function trg_interpellation_votes();

create or replace function trg_proposition_votes() returns trigger language plpgsql security definer set search_path = politique, extensions, public as $$
begin
  if tg_op = 'INSERT' then
    update propositions set votes_count = votes_count + 1 where id = new.proposition_id; return new;
  else
    update propositions set votes_count = greatest(votes_count - 1, 0) where id = old.proposition_id; return old;
  end if;
end $$;
create trigger proposition_votes_counts after insert or delete on proposition_votes for each row execute function trg_proposition_votes();

create or replace function trg_messages() returns trigger language plpgsql security definer set search_path = politique, extensions, public as $$
begin
  update conversations set last_message_at = new.created_at where id = new.conversation_id;
  update conversation_members set last_read_at = new.created_at where conversation_id = new.conversation_id and user_id = new.sender_id;
  insert into notifications (user_id, actor_id, type, ref_id)
  select cm.user_id, new.sender_id, 'message'::notification_type, new.conversation_id
  from conversation_members cm where cm.conversation_id = new.conversation_id and cm.user_id <> new.sender_id and not cm.muted;
  return new;
end $$;
create trigger messages_after after insert on messages for each row execute function trg_messages();

-- Interpellation answered by the official -> notify author and upvoters
create or replace function trg_interpellation_answered() returns trigger language plpgsql security definer set search_path = politique, extensions, public as $$
begin
  if new.status = 'repondue' and old.status <> 'repondue' then
    new.answered_at := now();
    insert into notifications (user_id, actor_id, type, post_id, ref_id)
    select distinct u, auth.uid(), 'interpellation_answer'::notification_type, new.answer_post_id, new.id
    from (select new.author_id as u union select user_id from interpellation_votes where interpellation_id = new.id) s
    where u <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  end if;
  return new;
end $$;
create trigger interpellations_answered before update on interpellations for each row execute function trg_interpellation_answered();

-- ---------------------------------------------------------------------------
-- Queries that need the private voting location (aggregates / own row only)
-- ---------------------------------------------------------------------------

-- "Mes élus": the officials whose mandate covers where the caller votes.
create or replace function my_officials()
returns setof officials
language sql stable security definer set search_path = politique, extensions, public as $$
  select o.* from officials o, private_profiles pp
  where pp.user_id = auth.uid()
    and (
      o.mandate in ('president')
      or (o.commune_id is not null and o.commune_id = pp.vote_commune_id)
      or (o.commune_id is null and o.department_id is not null and o.department_id = pp.vote_department_id)
      or (o.commune_id is null and o.department_id is null and o.region_id is not null and o.region_id = pp.vote_region_id)
    )
  order by case o.mandate
    when 'maire' then 1 when 'depute' then 2 when 'senateur' then 3
    when 'president_conseil_regional' then 4 when 'gouverneur_district' then 5
    when 'president' then 6 else 9 end
$$;

-- For an official: what share of an interpellation's upvoters vote in their
-- constituency. Returns null under 20 voters so nobody can be singled out.
create or replace function interpellation_constituent_share(iid uuid)
returns numeric
language plpgsql stable security definer set search_path = politique, extensions, public as $$
declare o officials%rowtype; total int; inside int;
begin
  select o2.* into o from officials o2 join interpellations i on i.official_id = o2.id where i.id = iid;
  if not found then return null; end if;
  if not (o.profile_id = auth.uid() or is_moderator()) then return null; end if;
  select count(*),
         count(*) filter (where (o.commune_id is not null and pp.vote_commune_id = o.commune_id)
                             or (o.commune_id is null and o.department_id is not null and pp.vote_department_id = o.department_id)
                             or (o.commune_id is null and o.department_id is null and pp.vote_region_id = o.region_id))
  into total, inside
  from interpellation_votes v join private_profiles pp on pp.user_id = v.user_id
  where v.interpellation_id = iid;
  if total < 20 then return null; end if;
  return round(100.0 * inside / total / 5) * 5;   -- nearest 5 %
end $$;

-- Aggregate audience of an official: how many registered users vote in their
-- constituency (rounded to the nearest 10, hidden under 50).
create or replace function official_constituents_count(oid uuid)
returns integer
language plpgsql stable security definer set search_path = politique, extensions, public as $$
declare o officials%rowtype; n int;
begin
  select * into o from officials where id = oid;
  if not found then return null; end if;
  select count(*) into n from private_profiles pp
  where (o.commune_id is not null and pp.vote_commune_id = o.commune_id)
     or (o.commune_id is null and o.department_id is not null and pp.vote_department_id = o.department_id)
     or (o.commune_id is null and o.department_id is null and o.region_id is not null and pp.vote_region_id = o.region_id);
  if n < 50 then return null; end if;
  return (n / 10) * 10;
end $$;

-- Barometer results per commune of vote, only where >= 50 votes; plus national totals.
create or replace function barometer_results(bid uuid)
returns table (commune_id smallint, commune_name text, votes integer, counts integer[])
language sql stable security definer set search_path = politique, extensions, public as $$
  with v as (
    select pp.vote_commune_id as cid, bv.option_idx
    from barometer_votes bv join private_profiles pp on pp.user_id = bv.user_id
    where bv.barometer_id = bid
  ),
  per as (
    select cid, count(*)::int as votes,
           array_agg(cnt order by idx) as counts
    from (select cid, idx, count(*) filter (where option_idx = idx)::int as cnt
          from v cross join generate_series(0, 5) idx group by cid, idx) s
    group by cid
  )
  select per.cid, c.name, per.votes, per.counts from per join ci_communes c on c.id = per.cid where per.votes >= 50
  union all
  select null, 'Côte d''Ivoire', count(*)::int,
         array[count(*) filter (where option_idx = 0)::int, count(*) filter (where option_idx = 1)::int,
               count(*) filter (where option_idx = 2)::int, count(*) filter (where option_idx = 3)::int,
               count(*) filter (where option_idx = 4)::int, count(*) filter (where option_idx = 5)::int]
  from v
$$;

-- ---------------------------------------------------------------------------
-- Feed & discovery
-- ---------------------------------------------------------------------------

-- Ranked "Pour vous" feed. Score = engagement * freshness, boosted for people
-- you follow, verified officials, and (privately) the officials of where you vote.
create or replace function feed_for_you(lim int default 30, before timestamptz default now(), off int default 0)
returns table (post_id uuid, score double precision, reason text)
language sql stable security definer set search_path = politique, extensions, public as $$
  with me as (select auth.uid() as id),
  mine as (select profile_id from my_officials() where profile_id is not null),
  cand as (
    select p.id, p.author_id, p.created_at,
      (ln(1 + p.like_count + 2 * p.reply_count + 3 * p.repost_count + 2 * p.quote_count)) as eng
    from posts p
    where p.kind <> 'reply' and p.deleted_at is null and p.is_hidden = false
      and p.visibility = 'public' and p.created_at < before
      and p.created_at > now() - interval '7 days'
      and not exists (select 1 from blocks b, me where (b.blocker_id = me.id and b.blocked_id = p.author_id) or (b.blocked_id = me.id and b.blocker_id = p.author_id))
      and not exists (select 1 from mutes m, me where m.muter_id = me.id and m.muted_id = p.author_id)
  )
  select c.id,
    (c.eng + 0.5)
      * (case when exists (select 1 from follows f, me where f.follower_id = me.id and f.followee_id = c.author_id) then 2.5 else 1 end)
      * (case when exists (select 1 from mine where mine.profile_id = c.author_id) then 3 else 1 end)
      * (case when exists (select 1 from profiles pr where pr.id = c.author_id and pr.verified) then 1.4 else 1 end)
      / power(1 + extract(epoch from (now() - c.created_at)) / 3600.0, 1.2) as score,
    case when exists (select 1 from mine where mine.profile_id = c.author_id) then 'votre_elu'
         when exists (select 1 from follows f, me where f.follower_id = me.id and f.followee_id = c.author_id) then 'abonnement'
         else 'tendance' end as reason
  from cand c
  order by score desc, c.created_at desc
  limit lim offset off
$$;

-- Trending hashtags, optionally for one commune (public opt-in post location).
create or replace function trending_hashtags(cid smallint default null, lim int default 10)
returns table (tag citext, posts_24h bigint, posts_total integer)
language sql stable security definer set search_path = politique, extensions, public as $$
  select ph.tag, count(*) as posts_24h, h.posts_count
  from post_hashtags ph join hashtags h on h.tag = ph.tag
  where ph.created_at > now() - interval '24 hours' and (cid is null or ph.commune_id = cid)
  group by ph.tag, h.posts_count, h.last_used_at
  order by posts_24h desc, h.last_used_at desc
  limit lim
$$;

-- Who to follow: verified officials and media near the caller's shown commune, then popular accounts.
create or replace function suggested_profiles(lim int default 6)
returns setof profiles
language sql stable security definer set search_path = politique, extensions, public as $$
  select p.* from profiles p
  where p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    and p.deleted_at is null and p.suspended_until is null
    and not exists (select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = p.id)
    and not is_blocked_between(auth.uid(), p.id)
  order by (p.id in (select profile_id from my_officials() where profile_id is not null)) desc,
           p.verified desc, p.followers_count desc
  limit lim
$$;

-- Search posts (full text, French) and profiles (trigram)
create or replace function search_posts(q text, lim int default 30)
returns setof posts
language sql stable security definer set search_path = politique, extensions, public as $$
  select p.* from posts p
  where p.deleted_at is null and p.is_hidden = false and p.visibility = 'public'
    and p.search @@ websearch_to_tsquery('french', f_unaccent(q))
  order by ts_rank(p.search, websearch_to_tsquery('french', f_unaccent(q))) desc, p.created_at desc
  limit lim
$$;
create or replace function search_profiles(q text, lim int default 10)
returns setof profiles
language sql stable security definer set search_path = politique, extensions, public as $$
  select p.* from profiles p
  where p.deleted_at is null and (p.handle::text ilike '%' || q || '%' or p.display_name ilike '%' || q || '%')
  order by p.verified desc, similarity(p.display_name, q) desc, p.followers_count desc
  limit lim
$$;

-- Post views (fire-and-forget from the client; no auth needed, bounded by RLS on nothing else)
create or replace function record_views(ids uuid[]) returns void
language sql security definer set search_path = politique, extensions, public as $$
  update posts set view_count = view_count + 1 where id = any(ids)
$$;

-- Start or reuse a 1:1 conversation
create or replace function get_or_create_dm(other uuid) returns uuid
language plpgsql security definer set search_path = politique, extensions, public as $$
declare cid uuid; me uuid := auth.uid();
begin
  if me is null or other = me then raise exception 'invalid'; end if;
  if is_blocked_between(me, other) then raise exception 'blocked'; end if;
  select c.id into cid from conversations c
   join conversation_members a on a.conversation_id = c.id and a.user_id = me
   join conversation_members b on b.conversation_id = c.id and b.user_id = other
   where not c.is_group limit 1;
  if cid is null then
    insert into conversations (is_group, created_by) values (false, me) returning id into cid;
    insert into conversation_members (conversation_id, user_id) values (cid, me), (cid, other);
  end if;
  return cid;
end $$;

-- Mark notifications read
create or replace function mark_notifications_read() returns void
language sql security definer set search_path = politique, extensions, public as $$
  update notifications set read_at = now() where user_id = auth.uid() and read_at is null
$$;

-- Unread counts for the shell badges
create or replace function unread_counts()
returns table (notifications bigint, messages bigint)
language sql stable security definer set search_path = politique, extensions, public as $$
  select
    (select count(*) from notifications n where n.user_id = auth.uid() and n.read_at is null and n.type <> 'message'),
    (select count(*) from conversation_members cm join conversations c on c.id = cm.conversation_id
      where cm.user_id = auth.uid() and c.last_message_at is not null and (cm.last_read_at is null or cm.last_read_at < c.last_message_at))
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table ci_regions enable row level security;
alter table ci_departments enable row level security;
alter table ci_communes enable row level security;
alter table profiles enable row level security;
alter table private_profiles enable row level security;
alter table officials enable row level security;
alter table follows enable row level security;
alter table blocks enable row level security;
alter table mutes enable row level security;
alter table posts enable row level security;
alter table polls enable row level security;
alter table poll_votes enable row level security;
alter table likes enable row level security;
alter table reposts enable row level security;
alter table bookmarks enable row level security;
alter table hashtags enable row level security;
alter table post_hashtags enable row level security;
alter table post_labels enable row level security;
alter table notifications enable row level security;
alter table conversations enable row level security;
alter table conversation_members enable row level security;
alter table messages enable row level security;
alter table reports enable row level security;
alter table moderation_actions enable row level security;
alter table verification_requests enable row level security;
alter table interpellations enable row level security;
alter table interpellation_votes enable row level security;
alter table promises enable row level security;
alter table promise_updates enable row level security;
alter table permanences enable row level security;
alter table barometers enable row level security;
alter table barometer_votes enable row level security;
alter table propositions enable row level security;
alter table proposition_votes enable row level security;
alter table waitlist enable row level security;

-- Geo: public read, admin write
create policy geo_read_r on ci_regions for select using (true);
create policy geo_read_d on ci_departments for select using (true);
create policy geo_read_c on ci_communes for select using (true);
create policy geo_admin_r on ci_regions for all using (is_admin()) with check (is_admin());
create policy geo_admin_d on ci_departments for all using (is_admin()) with check (is_admin());
create policy geo_admin_c on ci_communes for all using (is_admin()) with check (is_admin());

-- Profiles: public read, owner update (admins can update anyone)
create policy profiles_read on profiles for select using (deleted_at is null or id = auth.uid() or is_moderator());
create policy profiles_update_own on profiles for update using (id = auth.uid())
  with check (id = auth.uid() and is_admin = (select is_admin from profiles p where p.id = auth.uid())
              and is_moderator = (select is_moderator from profiles p where p.id = auth.uid())
              and verified = (select verified from profiles p where p.id = auth.uid())
              and account_type = (select account_type from profiles p where p.id = auth.uid())
              and suspended_until is not distinct from (select suspended_until from profiles p where p.id = auth.uid()));
create policy profiles_admin on profiles for update using (is_admin()) with check (is_admin());

-- Moderator operations go through functions so moderators never get blanket UPDATE on profiles.
create or replace function mod_notify(uid uuid, ntype notification_type, pid uuid default null) returns void
language plpgsql security definer set search_path = politique, extensions, public as $$
begin
  if not is_moderator() then raise exception 'forbidden'; end if;
  insert into notifications (user_id, actor_id, type, post_id) values (uid, null, ntype, pid);
end $$;

create or replace function mod_suspend(uid uuid, until timestamptz, why text default null) returns void
language plpgsql security definer set search_path = politique, extensions, public as $$
begin
  if not is_moderator() then raise exception 'forbidden'; end if;
  if exists (select 1 from profiles where id = uid and (is_admin or is_moderator)) and not is_admin() then raise exception 'forbidden'; end if;
  update profiles set suspended_until = until where id = uid;
  insert into moderation_actions (moderator_id, target_user_id, action, reason, expires_at)
  values (auth.uid(), uid, case when until is null then 'unban' when until > now() + interval '1 year' then 'ban' else 'suspend' end::moderation_action_type, why, until);
  if until is not null then
    insert into notifications (user_id, actor_id, type) values (uid, null, 'moderation');
  end if;
end $$;

create or replace function review_verification(rid uuid, approve boolean, note text default null) returns void
language plpgsql security definer set search_path = politique, extensions, public as $$
declare r verification_requests%rowtype;
begin
  if not is_moderator() then raise exception 'forbidden'; end if;
  select * into r from verification_requests where id = rid for update;
  if not found then raise exception 'not_found'; end if;
  update verification_requests set status = case when approve then 'approved' else 'rejected' end::verification_status,
         reviewed_by = auth.uid(), reviewed_at = now(), notes = note where id = rid;
  if approve then
    update profiles set verified = true, verified_at = now(), account_type = r.requested_type where id = r.user_id;
    if r.official_id is not null then
      update officials set profile_id = r.user_id, claimed_at = now() where id = r.official_id;
    end if;
    insert into moderation_actions (moderator_id, target_user_id, action) values (auth.uid(), r.user_id, 'verify');
  end if;
  insert into notifications (user_id, actor_id, type) values (r.user_id, null, 'verification');
end $$;

-- Handle availability for the sign-up form (profiles are public, this just avoids a round of RLS).
create or replace function handle_available(h text) returns boolean
language sql stable security definer set search_path = politique, extensions, public as $$
  select h ~ '^[a-z0-9_]{3,20}$' and not exists (select 1 from profiles where handle = h)
$$;

-- Private profile: owner only. No other policy, ever.
create policy private_own_select on private_profiles for select using (user_id = auth.uid());
create policy private_own_update on private_profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy private_own_insert on private_profiles for insert with check (user_id = auth.uid());

-- Officials: public read; moderators manage; a verified official can edit their own row
create policy officials_read on officials for select using (true);
create policy officials_mod on officials for all using (is_moderator()) with check (is_moderator());
create policy officials_self on officials for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Graph
create policy follows_read on follows for select using (true);
create policy follows_insert on follows for insert with check (follower_id = auth.uid() and not is_suspended(auth.uid()) and not is_blocked_between(follower_id, followee_id));
create policy follows_delete on follows for delete using (follower_id = auth.uid());
create policy blocks_own on blocks for all using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create policy mutes_own on mutes for all using (muter_id = auth.uid()) with check (muter_id = auth.uid());

-- Posts
create policy posts_read on posts for select using (
  (deleted_at is null and (is_hidden = false or author_id = auth.uid() or is_moderator())
    and (visibility = 'public' or author_id = auth.uid() or follows_user(auth.uid(), author_id) or is_moderator())
    and not is_blocked_between(auth.uid(), author_id))
  or author_id = auth.uid() or is_moderator()
);
create policy posts_insert on posts for insert with check (
  author_id = auth.uid() and not is_suspended(auth.uid())
  and (parent_id is null or not is_blocked_between(auth.uid(), post_author(parent_id)))
);
create policy posts_update_own on posts for update using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy posts_mod on posts for update using (is_moderator()) with check (is_moderator());

create policy polls_read on polls for select using (true);
create policy polls_insert on polls for insert with check (exists (select 1 from posts p where p.id = post_id and p.author_id = auth.uid()));
create policy poll_votes_read on poll_votes for select using (user_id = auth.uid());
create policy poll_votes_insert on poll_votes for insert with check (
  user_id = auth.uid() and not is_suspended(auth.uid()) and exists (select 1 from polls where polls.post_id = poll_votes.post_id and polls.ends_at > now()));

create policy likes_read on likes for select using (true);
create policy likes_own on likes for insert with check (user_id = auth.uid() and not is_suspended(auth.uid()));
create policy likes_del on likes for delete using (user_id = auth.uid());
create policy reposts_read on reposts for select using (true);
create policy reposts_own on reposts for insert with check (user_id = auth.uid() and not is_suspended(auth.uid()));
create policy reposts_del on reposts for delete using (user_id = auth.uid());
create policy bookmarks_own on bookmarks for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy hashtags_read on hashtags for select using (true);
create policy post_hashtags_read on post_hashtags for select using (true);
create policy post_labels_read on post_labels for select using (true);
create policy post_labels_write on post_labels for insert with check (labeled_by = auth.uid() and (is_moderator() or is_verified_media()));
create policy post_labels_delete on post_labels for delete using (labeled_by = auth.uid() or is_moderator());

-- Notifications: own only
create policy notifications_own on notifications for select using (user_id = auth.uid());
create policy notifications_update on notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Messages: members only
create policy conversations_read on conversations for select using (is_conversation_member(id) or created_by = auth.uid());
create policy conversations_insert on conversations for insert with check (created_by = auth.uid());
create policy members_read on conversation_members for select using (user_id = auth.uid() or is_conversation_member(conversation_id));
create policy members_insert on conversation_members for insert with check (
  exists (select 1 from conversations c where c.id = conversation_id and c.created_by = auth.uid()) and not is_blocked_between(auth.uid(), user_id));
create policy members_update_own on conversation_members for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy messages_read on messages for select using (is_conversation_member(conversation_id));
create policy messages_insert on messages for insert with check (
  sender_id = auth.uid() and not is_suspended(auth.uid())
  and is_conversation_member(conversation_id));
create policy messages_delete_own on messages for update using (sender_id = auth.uid()) with check (sender_id = auth.uid());

-- Moderation
create policy reports_insert on reports for insert with check (reporter_id = auth.uid());
create policy reports_read on reports for select using (reporter_id = auth.uid() or is_moderator());
create policy reports_mod on reports for update using (is_moderator()) with check (is_moderator());
create policy modactions_read on moderation_actions for select using (is_moderator() or target_user_id = auth.uid());
create policy modactions_insert on moderation_actions for insert with check (is_moderator() and moderator_id = auth.uid());
create policy verif_own on verification_requests for select using (user_id = auth.uid() or is_moderator());
create policy verif_insert on verification_requests for insert with check (user_id = auth.uid());
create policy verif_mod on verification_requests for update using (is_moderator()) with check (is_moderator());

-- Ivorian features
create policy interp_read on interpellations for select using (true);
create policy interp_insert on interpellations for insert with check (author_id = auth.uid() and not is_suspended(auth.uid()));
create policy interp_author on interpellations for update using (author_id = auth.uid() and status = 'ouverte') with check (author_id = auth.uid());
create policy interp_official on interpellations for update using (
  exists (select 1 from officials o where o.id = official_id and o.profile_id = auth.uid()) or is_moderator());
create policy interp_votes_own on interpellation_votes for all using (user_id = auth.uid()) with check (user_id = auth.uid() and not is_suspended(auth.uid()));

create policy promises_read on promises for select using (true);
create policy promises_insert on promises for insert with check (created_by = auth.uid() and not is_suspended(auth.uid()));
create policy promises_update on promises for update using (
  is_moderator() or is_verified_media() or exists (select 1 from officials o where o.id = official_id and o.profile_id = auth.uid()));
create policy promise_updates_read on promise_updates for select using (true);
create policy promise_updates_insert on promise_updates for insert with check (author_id = auth.uid() and not is_suspended(auth.uid()));

create policy permanences_read on permanences for select using (true);
create policy permanences_write on permanences for all using (
  host_id = auth.uid() and exists (select 1 from officials o where o.id = official_id and o.profile_id = auth.uid())) with check (host_id = auth.uid());
create policy permanences_mod on permanences for all using (is_moderator()) with check (is_moderator());

create policy barometers_read on barometers for select using (true);
create policy barometers_admin on barometers for all using (is_admin()) with check (is_admin());
create policy barometer_votes_own on barometer_votes for select using (user_id = auth.uid());
create policy barometer_votes_insert on barometer_votes for insert with check (
  user_id = auth.uid() and exists (select 1 from barometers b where b.id = barometer_id and now() between b.opens_at and b.closes_at));

create policy propositions_read on propositions for select using (true);
create policy propositions_insert on propositions for insert with check (author_id = auth.uid() and not is_suspended(auth.uid()));
create policy propositions_update on propositions for update using (
  author_id = auth.uid() or is_moderator() or exists (select 1 from officials o where o.commune_id = propositions.commune_id and o.profile_id = auth.uid()));
create policy proposition_votes_own on proposition_votes for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy waitlist_admin on waitlist for select using (is_admin());

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table notifications, messages;

-- ---------------------------------------------------------------------------
-- Storage buckets: "media" (public: avatars, banners, post images/videos),
-- "documents" (private: ID documents for verification)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('politique-media', 'politique-media', true, 52428800, array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'])
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('politique-documents', 'politique-documents', false, 10485760, array['image/jpeg','image/png','application/pdf'])
on conflict (id) do nothing;

create policy politique_media_read on storage.objects for select using (bucket_id = 'politique-media');
create policy politique_media_write on storage.objects for insert with check (
  bucket_id = 'politique-media' and auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text);
create policy politique_media_delete on storage.objects for delete using (
  bucket_id = 'politique-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy politique_documents_own on storage.objects for all using (
  bucket_id = 'politique-documents' and ((storage.foldername(name))[1] = auth.uid()::text or is_moderator()))
  with check (bucket_id = 'politique-documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Privileges. Stated explicitly so the schema does not depend on a project's
-- default grants. Row level security above decides what each role can see or
-- change; the revokes below are a second lock on data a signed-out visitor
-- never needs.
-- ---------------------------------------------------------------------------
grant usage on schema politique, extensions to anon, authenticated, service_role;
grant select on all tables in schema politique to anon;
grant select, insert, update, delete on all tables in schema politique to authenticated;
grant all on all tables in schema politique to service_role;
grant usage, select on all sequences in schema politique to authenticated, service_role;
grant execute on all functions in schema politique to anon, authenticated, service_role;

revoke all on private_profiles, notifications, conversations, conversation_members, messages,
  bookmarks, blocks, mutes, poll_votes, barometer_votes, interpellation_votes, proposition_votes,
  reports, moderation_actions, verification_requests, waitlist from anon;
