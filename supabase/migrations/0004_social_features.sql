-- POLITIQUE — editing and pinning posts, link previews, group conversations and images in
-- messages, e-mail and push notifications, anti-spam limits and a word filter.
-- Additive only: nothing is dropped, so it can be applied to the shared project without risk
-- to what is already there. Safe to run twice.
set search_path = politique, extensions, public;

-- ---------------------------------------------------------------------------
-- New columns and tables
-- ---------------------------------------------------------------------------
alter table posts add column if not exists link jsonb;                    -- {url,title,description,image,site}, written by the server only
alter table notifications add column if not exists delivered_at timestamptz; -- set once e-mail/push delivery was attempted

-- What a post said before each edit. Public, like the post itself: on a political
-- network people must be able to see what was changed.
create table if not exists post_edits (
  id         bigint generated always as identity primary key,
  post_id    uuid not null references posts(id) on delete cascade,
  text       text not null,
  created_at timestamptz not null default now()
);
create index if not exists post_edits_post on post_edits(post_id, created_at desc);

create table if not exists notification_prefs (
  user_id         uuid primary key references profiles(id) on delete cascade,
  email_replies   boolean not null default true,    -- replies, mentions, quotes
  email_messages  boolean not null default true,
  email_follows   boolean not null default false,
  email_officials boolean not null default true,    -- answers to interpellations
  push_replies    boolean not null default true,
  push_messages   boolean not null default true,
  push_follows    boolean not null default true,
  push_likes      boolean not null default true,    -- likes and reposts
  push_officials  boolean not null default true,    -- your officials' posts and answers
  updated_at      timestamptz not null default now()
);

create table if not exists push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user on push_subscriptions(user_id);

-- One row per notification e-mail sent, to throttle them. Service role only.
create table if not exists notification_email_log (
  id       bigint generated always as identity primary key,
  user_id  uuid not null references profiles(id) on delete cascade,
  category text not null,
  sent_at  timestamptz not null default now()
);
create index if not exists notification_email_log_user on notification_email_log(user_id, sent_at desc);
create index if not exists notification_email_log_time on notification_email_log(sent_at desc);

-- Words and expressions refused in public posts. Managed by moderators.
create table if not exists blocked_terms (
  term       citext primary key check (char_length(term) between 2 and 80),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists messages_sender_time on messages(sender_id, created_at desc);
create index if not exists reports_reporter_time on reports(reporter_id, created_at desc);
create index if not exists likes_user_time on likes(user_id, created_at desc);
create index if not exists follows_follower_time on follows(follower_id, created_at desc);
create index if not exists notifications_pending on notifications(created_at) where delivered_at is null;
create index if not exists posts_pinned on posts(author_id) where is_pinned;

alter table post_edits enable row level security;
alter table notification_prefs enable row level security;
alter table push_subscriptions enable row level security;
alter table notification_email_log enable row level security;
alter table blocked_terms enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'politique' and policyname = 'post_edits_read') then
    -- Visible to whoever can see the post (the sub-select runs under the posts policies).
    create policy post_edits_read on post_edits for select using (exists (select 1 from posts p where p.id = post_id));
    create policy notification_prefs_own on notification_prefs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
    create policy push_subscriptions_own on push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
    create policy blocked_terms_mod on blocked_terms for all using (is_moderator()) with check (is_moderator());
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Who is asking. Supabase sets the role claim; direct SQL (editor, seeds) has none.
-- ---------------------------------------------------------------------------
create or replace function request_role() returns text
language sql stable set search_path = politique, extensions, public as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    '')
$$;

-- ---------------------------------------------------------------------------
-- Word filter and spam shapes for public posts
-- ---------------------------------------------------------------------------
create or replace function check_content(txt text) returns void
language plpgsql stable security definer set search_path = politique, extensions, public as $$
declare clean text := ' ' || f_unaccent(lower(coalesce(txt, ''))) || ' ';
begin
  if exists (
    select 1 from blocked_terms b
    where clean ~ ('[^[:alnum:]]' || regexp_replace(f_unaccent(lower(b.term::text)), '([][\\.^$*+?(){}|-])', '\\\1', 'g') || '[^[:alnum:]]')
  ) then
    raise exception 'blocked_term' using errcode = 'P0001';
  end if;
  if (select count(*) from regexp_matches(txt, 'https?://', 'gi')) > 4 then
    raise exception 'too_many_links' using errcode = 'P0001';
  end if;
  if (select count(*) from regexp_matches(txt, '(?:^|[^\w])@[a-z0-9_]{3,20}', 'gi')) > 10 then
    raise exception 'too_many_mentions' using errcode = 'P0001';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Posts: the before trigger now also runs when the text is edited, clears link
-- previews that did not come from the server, refuses filtered words and
-- back-to-back duplicates.
-- ---------------------------------------------------------------------------
create or replace function trg_posts_before() returns trigger language plpgsql security definer set search_path = politique, extensions, public as $$
declare p posts%rowtype; tags text[]; mentions_arr uuid[]; trusted boolean := request_role() = 'service_role';
begin
  if tg_op = 'INSERT' then
    if new.parent_id is not null then
      select * into p from posts where id = new.parent_id;
      new.root_id := coalesce(p.root_id, p.id);
    end if;
    if not trusted then
      new.link := null;        -- previews are fetched and attached by the server afterwards
      new.is_pinned := false;
      new.edited_at := null;
    end if;
    if not trusted and auth.uid() is not null and new.text <> '' and exists (
      select 1 from posts d where d.author_id = new.author_id and d.text = new.text and d.deleted_at is null
        and d.parent_id is not distinct from new.parent_id and d.created_at > now() - interval '10 minutes'
    ) then
      raise exception 'duplicate_post' using errcode = 'P0001';
    end if;
  end if;
  if not trusted and auth.uid() is not null then
    perform check_content(new.text);
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
create or replace trigger posts_before before insert or update of text on posts for each row execute function trg_posts_before();

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
      if m <> new.author_id and m is distinct from parent_author then
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
  elsif tg_op = 'UPDATE' and new.text is distinct from old.text then
    -- An edit: keep the hashtag index in step and notify people newly mentioned.
    foreach t in array old.hashtags loop
      if not (t = any (new.hashtags)) then
        delete from post_hashtags where post_id = new.id and tag = t;
        update hashtags set posts_count = greatest(posts_count - 1, 0) where tag = t;
      end if;
    end loop;
    foreach t in array new.hashtags loop
      if not (t = any (old.hashtags)) then
        insert into hashtags (tag, posts_count, last_used_at) values (t, 1, now())
          on conflict (tag) do update set posts_count = hashtags.posts_count + 1, last_used_at = now();
        insert into post_hashtags (post_id, tag, commune_id) values (new.id, t, new.commune_id) on conflict do nothing;
      end if;
    end loop;
    foreach m in array new.mentions loop
      if m <> new.author_id and not (m = any (old.mentions)) then
        insert into notifications (user_id, actor_id, type, post_id) values (m, new.author_id, 'mention', new.id);
      end if;
    end loop;
    return new;
  end if;
  return new;
end $$;

-- Authors may only delete their post through the API; everything else goes through
-- the functions below. Moderators keep "hide". (Until now an author could rewrite any
-- column of their own post, counters and moderation flag included.)
revoke update on posts from authenticated;
grant update (deleted_at, is_hidden) on posts to authenticated;

create or replace function trg_posts_guard() returns trigger language plpgsql security definer set search_path = politique, extensions, public as $$
begin
  if request_role() = 'authenticated' then
    if new.is_hidden is distinct from old.is_hidden and not is_moderator() then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    if old.deleted_at is not null and new.deleted_at is distinct from old.deleted_at then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create or replace trigger posts_guard before update of is_hidden, deleted_at on posts for each row execute function trg_posts_guard();

-- Edit a post during the hour after it was published. The previous text is kept.
create or replace function edit_post(pid uuid, new_text text) returns posts
language plpgsql security definer set search_path = politique, extensions, public as $$
declare p posts%rowtype; body text := btrim(coalesce(new_text, ''));
begin
  select * into p from posts where id = pid for update;
  if not found or auth.uid() is null or p.author_id <> auth.uid() or p.deleted_at is not null or p.is_hidden or is_suspended(auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p.created_at < now() - interval '1 hour' then raise exception 'edit_window' using errcode = 'P0001'; end if;
  if char_length(body) > 1000 or (body = '' and p.media = '[]'::jsonb) then raise exception 'invalid' using errcode = 'P0001'; end if;
  if exists (select 1 from polls where post_id = pid and votes_count > 0) then raise exception 'poll_has_votes' using errcode = 'P0001'; end if;
  if body = p.text then return p; end if;
  if (select count(*) from post_edits where post_id = pid) >= 5 then raise exception 'edit_limit' using errcode = 'P0001'; end if;
  insert into post_edits (post_id, text, created_at) values (pid, p.text, coalesce(p.edited_at, p.created_at));
  -- The preview card goes when its link is no longer in the text; the server attaches a fresh one.
  update posts set text = body, edited_at = now(),
         link = case when link is not null and position(link ->> 'url' in body) > 0 then link else null end
   where id = pid returning * into p;
  return p;
end $$;

-- Pin one post to the top of your profile (pinning another replaces it).
create or replace function pin_post(pid uuid, pinned boolean) returns void
language plpgsql security definer set search_path = politique, extensions, public as $$
begin
  if auth.uid() is null or not exists (select 1 from posts where id = pid and author_id = auth.uid() and deleted_at is null) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update posts set is_pinned = false where author_id = auth.uid() and is_pinned and id <> pid;
  update posts set is_pinned = pinned where id = pid;
end $$;

-- ---------------------------------------------------------------------------
-- Anti-spam: per-person frequency limits, enforced in the database so they hold
-- whatever client is used. Arguments: owner column, then (max, interval) pairs.
-- ---------------------------------------------------------------------------
create or replace function trg_rate_limit() returns trigger language plpgsql security definer set search_path = politique, extensions, public as $$
declare uid uuid := auth.uid(); n int; i int := 1;
begin
  if uid is null or request_role() = 'service_role' then return new; end if;
  while i + 1 < tg_nargs loop
    execute format('select count(*) from %I.%I where %I = $1 and created_at > now() - $2::interval', tg_table_schema, tg_table_name, tg_argv[0])
      into n using uid, tg_argv[i + 1];
    if n >= tg_argv[i]::int then
      raise exception 'rate_limit' using errcode = 'P0001', hint = tg_table_name;
    end if;
    i := i + 2;
  end loop;
  return new;
end $$;

create or replace trigger rate_posts before insert on posts for each row execute function trg_rate_limit('author_id', '8', '1 minute', '60', '1 hour', '250', '1 day');
create or replace trigger rate_messages before insert on messages for each row execute function trg_rate_limit('sender_id', '30', '1 minute', '500', '1 hour');
create or replace trigger rate_reports before insert on reports for each row execute function trg_rate_limit('reporter_id', '5', '10 minutes', '30', '1 day');
create or replace trigger rate_follows before insert on follows for each row execute function trg_rate_limit('follower_id', '30', '1 minute', '200', '1 hour');
create or replace trigger rate_likes before insert on likes for each row execute function trg_rate_limit('user_id', '60', '1 minute', '1500', '1 day');
create or replace trigger rate_reposts before insert on reposts for each row execute function trg_rate_limit('user_id', '30', '1 minute', '500', '1 day');
create or replace trigger rate_interpellations before insert on interpellations for each row execute function trg_rate_limit('author_id', '3', '1 hour', '10', '1 day');
create or replace trigger rate_propositions before insert on propositions for each row execute function trg_rate_limit('author_id', '3', '1 hour', '10', '1 day');
create or replace trigger rate_conversations before insert on conversations for each row execute function trg_rate_limit('created_by', '15', '1 hour', '60', '1 day');
create or replace trigger rate_verifications before insert on verification_requests for each row execute function trg_rate_limit('user_id', '3', '1 day');

-- ---------------------------------------------------------------------------
-- Group conversations
-- ---------------------------------------------------------------------------
create or replace function create_group(group_title text, member_ids uuid[]) returns uuid
language plpgsql security definer set search_path = politique, extensions, public as $$
declare cid uuid; me uuid := auth.uid(); ids uuid[];
begin
  if me is null or is_suspended(me) then raise exception 'forbidden' using errcode = '42501'; end if;
  select coalesce(array_agg(distinct x), '{}') into ids from unnest(member_ids) x where x <> me;
  if coalesce(array_length(ids, 1), 0) < 2 or array_length(ids, 1) > 49 then raise exception 'invalid' using errcode = 'P0001'; end if;
  if (select count(*) from profiles where id = any (ids) and deleted_at is null) <> array_length(ids, 1) then raise exception 'invalid' using errcode = 'P0001'; end if;
  if exists (select 1 from unnest(ids) x where is_blocked_between(me, x)) then raise exception 'blocked' using errcode = 'P0001'; end if;
  insert into conversations (is_group, title, created_by) values (true, nullif(btrim(left(coalesce(group_title, ''), 60)), ''), me) returning id into cid;
  insert into conversation_members (conversation_id, user_id) values (cid, me);
  insert into conversation_members (conversation_id, user_id) select cid, x from unnest(ids) x;
  return cid;
end $$;

create or replace function leave_conversation(cid uuid) returns void
language plpgsql security definer set search_path = politique, extensions, public as $$
begin
  if not exists (select 1 from conversations where id = cid and is_group) then raise exception 'invalid' using errcode = 'P0001'; end if;
  delete from conversation_members where conversation_id = cid and user_id = auth.uid();
end $$;

-- Images in messages live in a private bucket: <conversation>/<sender>/<file>.
-- Only the members of the conversation can read them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('politique-dm', 'politique-dm', false, 8388608, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

create or replace function dm_object_ok(n text) returns boolean
language plpgsql stable security definer set search_path = politique, extensions, public as $$
declare parts text[] := string_to_array(n, '/');
begin
  if array_length(parts, 1) <> 3 then return false; end if;
  return is_conversation_member(parts[1]::uuid);
exception when others then
  return false;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'politique_dm_read') then
    -- CASE keeps the function away from every other bucket's objects.
    create policy politique_dm_read on storage.objects for select using (
      case when bucket_id = 'politique-dm' then politique.dm_object_ok(name) else false end);
    create policy politique_dm_write on storage.objects for insert with check (
      case when bucket_id = 'politique-dm' then politique.dm_object_ok(name) and split_part(name, '/', 2) = auth.uid()::text and politique.feature_allowed('media_uploads') else false end);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Notification delivery (e-mail and push). The server claims what is pending,
-- at most once, and gets everything it needs to send in one call.
-- ---------------------------------------------------------------------------
create or replace function notification_category(t notification_type) returns text
language sql immutable set search_path = politique, extensions, public as $$
  select case t
    when 'reply' then 'replies' when 'mention' then 'replies' when 'quote' then 'replies'
    when 'message' then 'messages'
    when 'follow' then 'follows'
    when 'like' then 'likes' when 'repost' then 'likes'
    when 'interpellation_answer' then 'officials' when 'official_post' then 'officials'
    when 'verification' then 'account' when 'moderation' then 'account'
    else 'other' end
$$;

create or replace function claim_notifications(lim int default 40, daily_cap int default 60)
returns table (
  id uuid, user_id uuid, type notification_type, category text, actor_id uuid, post_id uuid, ref_id uuid,
  email text, lang text, actor_name text, actor_handle text, post_text text,
  want_email boolean, want_push boolean
)
language plpgsql security definer set search_path = politique, extensions, public as $$
declare sent_today int;
begin
  select count(*) into sent_today from notification_email_log l where l.sent_at > now() - interval '1 day';
  return query
  with picked as (
    select n.id from notifications n
    where n.delivered_at is null and n.read_at is null and n.created_at > now() - interval '30 minutes'
    order by n.created_at limit lim for update skip locked
  ),
  upd as (
    update notifications n set delivered_at = now() from picked where n.id = picked.id
    returning n.id, n.user_id, n.type, n.actor_id, n.post_id, n.ref_id
  )
  select u.id, u.user_id, u.type, notification_category(u.type), u.actor_id, u.post_id, u.ref_id,
         au.email::text, p.lang, a.display_name, a.handle::text, left(po.text, 240),
         -- e-mail: important events only, opt-out per category, at most one per category
         -- every 30 minutes and six a day per person, and a global daily ceiling.
         (au.email is not null and sent_today < daily_cap
          and p.deleted_at is null and (p.suspended_until is null or p.suspended_until < now() or notification_category(u.type) = 'account')
          and case notification_category(u.type)
                when 'replies' then coalesce(np.email_replies, true)
                when 'messages' then coalesce(np.email_messages, true)
                when 'follows' then coalesce(np.email_follows, false)
                when 'officials' then u.type = 'interpellation_answer' and coalesce(np.email_officials, true)
                when 'account' then true
                else false end
          and not exists (select 1 from notification_email_log l where l.user_id = u.user_id and l.category = notification_category(u.type) and l.sent_at > now() - interval '30 minutes')
          and (select count(*) from notification_email_log l where l.user_id = u.user_id and l.sent_at > now() - interval '1 day') < 6),
         (exists (select 1 from push_subscriptions s where s.user_id = u.user_id)
          and case notification_category(u.type)
                when 'replies' then coalesce(np.push_replies, true)
                when 'messages' then coalesce(np.push_messages, true)
                when 'follows' then coalesce(np.push_follows, true)
                when 'likes' then coalesce(np.push_likes, true)
                when 'officials' then coalesce(np.push_officials, true)
                when 'account' then true
                else false end)
  from upd u
  join profiles p on p.id = u.user_id
  left join auth.users au on au.id = u.user_id
  left join profiles a on a.id = u.actor_id
  left join posts po on po.id = u.post_id and po.deleted_at is null and po.is_hidden = false
  left join notification_prefs np on np.user_id = u.user_id;
end $$;

-- ---------------------------------------------------------------------------
-- Privileges for what this file adds
-- ---------------------------------------------------------------------------
grant select on post_edits to anon;
grant select, insert, update, delete on post_edits, notification_prefs, push_subscriptions, blocked_terms to authenticated;
revoke insert, update, delete on post_edits from authenticated;
grant all on post_edits, notification_prefs, push_subscriptions, notification_email_log, blocked_terms to service_role;
grant usage, select on all sequences in schema politique to authenticated, service_role;
revoke all on notification_email_log from anon, authenticated;

grant execute on function request_role(), check_content(text), notification_category(notification_type), dm_object_ok(text) to anon, authenticated, service_role;
grant execute on function edit_post(uuid, text), pin_post(uuid, boolean), create_group(text, uuid[]), leave_conversation(uuid) to authenticated, service_role;
revoke execute on function edit_post(uuid, text), pin_post(uuid, boolean), create_group(text, uuid[]), leave_conversation(uuid) from public, anon;
revoke execute on function claim_notifications(int, int) from public, anon, authenticated;
grant execute on function claim_notifications(int, int) to service_role;
