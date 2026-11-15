-- POLITIQUE — editing and pinning posts, link previews, group conversations,
-- anti-spam limits and a word filter.
-- Additive only: nothing is dropped, so it can be applied to the shared project without risk
-- to what is already there. Safe to run twice.
set search_path = politique, extensions, public;

-- ---------------------------------------------------------------------------
-- New columns and tables
-- ---------------------------------------------------------------------------
alter table posts add column if not exists link jsonb;                    -- {url,title,description,image,site}, written by the server only

-- What a post said before each edit. Public, like the post itself: on a political
-- network people must be able to see what was changed.
create table if not exists post_edits (
  id         bigint generated always as identity primary key,
  post_id    uuid not null references posts(id) on delete cascade,
  text       text not null,
  created_at timestamptz not null default now()
);
create index if not exists post_edits_post on post_edits(post_id, created_at desc);

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
create index if not exists posts_pinned on posts(author_id) where is_pinned;

alter table post_edits enable row level security;
alter table blocked_terms enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'politique' and policyname = 'post_edits_read') then
    -- Visible to whoever can see the post (the sub-select runs under the posts policies).
    create policy post_edits_read on post_edits for select using (exists (select 1 from posts p where p.id = post_id));
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
declare clean text := ' ' || regexp_replace(f_unaccent(lower(coalesce(txt, ''))), '\s+', ' ', 'g') || ' ';
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

-- ---------------------------------------------------------------------------
-- Privileges for what this file adds
-- ---------------------------------------------------------------------------
grant select on post_edits to anon;
grant select, insert, update, delete on post_edits, blocked_terms to authenticated;
revoke insert, update, delete on post_edits from authenticated;
grant all on post_edits, blocked_terms to service_role;
grant usage, select on all sequences in schema politique to authenticated, service_role;

grant execute on function request_role(), check_content(text) to anon, authenticated, service_role;
grant execute on function edit_post(uuid, text), pin_post(uuid, boolean), create_group(text, uuid[]), leave_conversation(uuid) to authenticated, service_role;
revoke execute on function edit_post(uuid, text), pin_post(uuid, boolean), create_group(text, uuid[]), leave_conversation(uuid) from public, anon;
