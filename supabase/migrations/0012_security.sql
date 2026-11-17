-- Security review of 17 November 2026: account creation, who may change what, follow, search.
--
-- Every table is reachable straight from the browser with the public key and the
-- member's own session, so the database, not the interface, has to refuse what a
-- member may not do. This migration closes the holes found in that review:
--
--  1. Following the owner failed: the follow counter update was refused by the owner guard.
--  2. Members could write columns that only the system should write (follower counts,
--     like and view counts, vote counts, the "verified by" of a promise, the date a row
--     was created, which also slipped past the rate limits).
--  3. A member could join any conversation by changing conversation_id on their own
--     membership row, or move one of their messages into another conversation.
--  4. A linked official could rewrite their own directory row (mandate, commune, holder),
--     for example to pose as a commune's mayor and edit its Découvertes page.
--  5. Verification requests and reports could be inserted already "approved" / "actioned".
--  6. Official accounts, verification, the directory and the Découvertes pages are now
--     managed by the owner and the admins the owner names, not by moderators.
--  7. A name is required: at least two letters, no e-mail address. People who joined
--     without one (or whose name was the start of their e-mail address) are asked again.
--  8. Account search ignores accents and case, accepts "@handle", parts of a name in any
--     order, and small typos.
--
-- "Trusted" below means SQL run by the project itself (SQL editor, migrations, the
-- server's service key): it is never limited by these rules.
set search_path = politique, extensions, public;

create or replace function is_untrusted() returns boolean
language sql stable set search_path = politique, extensions, public as $$
  select coalesce(current_setting('role', true), 'none') in ('authenticated', 'anon')
     and request_role() <> 'service_role'
$$;

-- ---------------------------------------------------------------------------
-- 1. Profiles: what a member may change on their own profile
-- ---------------------------------------------------------------------------
alter table profiles add column if not exists needs_name boolean not null default false;

-- Only these columns, whatever the row-level policy says. Roles, badge, sanctions and
-- counters change only through the database's own functions and triggers.
revoke update on profiles from authenticated, anon;
grant update (display_name, handle, bio, avatar_url, banner_url, website, lang, theme,
              low_data, shown_commune_id, onboarded_at) on profiles to authenticated;

-- The owner guard ran on the follower counter too (an update made by the follow trigger,
-- on the owner's row, by someone else), so nobody could follow the owner.
-- Updates made by another trigger (counters) are the database's own work and pass.
create or replace function trg_profiles_guard() returns trigger
language plpgsql security definer set search_path = politique, extensions, public as $$
declare me uuid := auth.uid();
begin
  if me is null or not is_untrusted() or pg_trigger_depth() > 1 then return new; end if;
  if new.is_owner is distinct from old.is_owner then raise exception 'forbidden'; end if;
  if new.is_admin is distinct from old.is_admin and not is_owner() then raise exception 'forbidden'; end if;
  if new.is_moderator is distinct from old.is_moderator and not is_admin() then raise exception 'forbidden'; end if;
  -- Nobody but the owner touches the owner's account; only the owner sanctions an admin.
  if old.id <> me and old.is_owner then raise exception 'forbidden'; end if;
  if old.id <> me and old.is_admin and not is_owner()
     and (new.suspended_until is distinct from old.suspended_until or new.verified is distinct from old.verified
          or new.deleted_at is distinct from old.deleted_at) then
    raise exception 'forbidden';
  end if;
  return new;
end $$;

-- A real name: 2 to 50 characters, at least two letters, no e-mail address or link.
create or replace function clean_display_name(t text) returns text
language sql immutable set search_path = politique, extensions, public as $$
  select btrim(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g'))
$$;
create or replace function valid_display_name(t text) returns boolean
language sql immutable set search_path = politique, extensions, public as $$
  select char_length(clean_display_name(t)) between 2 and 50
     and f_unaccent(clean_display_name(t)) ~ '[A-Za-z].*[A-Za-z]'
     and clean_display_name(t) !~ '@'
     and clean_display_name(t) !~* '(https?://|www\.)'
$$;

create or replace function trg_profiles_name() returns trigger
language plpgsql security definer set search_path = politique, extensions, public as $$
begin
  if not is_untrusted() then return new; end if;
  if tg_op = 'UPDATE' and new.display_name is not distinct from old.display_name then return new; end if;
  new.display_name := clean_display_name(new.display_name);
  if tg_op = 'UPDATE' then
    if not valid_display_name(new.display_name) then raise exception 'invalid_name' using errcode = 'P0001'; end if;
    new.needs_name := false;
  end if;
  return new;
end $$;
drop trigger if exists profiles_name on profiles;
create trigger profiles_name before insert or update of display_name on profiles
  for each row execute function trg_profiles_name();

-- Handles that would pass for the platform or its staff.
create or replace function is_reserved_handle(h text) returns boolean
language sql immutable set search_path = politique, extensions, public as $$
  select coalesce(
    is_reserved_name(h)
    or lower(h) ~ '(admin|moderat|politique|officiel|verifi)'
    or lower(h) in ('support', 'aide', 'help', 'staff', 'equipe', 'team', 'securite', 'security', 'root', 'system', 'systeme', 'contact'),
    false)
$$;
create or replace function trg_profiles_reserved_names() returns trigger
language plpgsql security definer set search_path = politique, extensions, public as $$
begin
  if new.is_owner or not is_untrusted() then return new; end if;
  if tg_op = 'INSERT' then
    if is_reserved_name(new.display_name) then new.display_name := new.handle::text; new.needs_name := true; end if;
    if is_reserved_handle(new.handle::text) then raise exception 'reserved_name'; end if;
  else
    if new.display_name is distinct from old.display_name and
       (is_reserved_name(new.display_name) or new.display_name ~* '(administrat|mod[eé]rat|compte officiel)') then
      raise exception 'reserved_name';
    end if;
    if new.handle is distinct from old.handle and is_reserved_handle(new.handle::text) then
      raise exception 'reserved_name';
    end if;
  end if;
  return new;
end $$;

create or replace function handle_available(h text) returns boolean
language sql stable security definer set search_path = politique, extensions, public as $$
  select h ~ '^[a-z0-9_]{3,20}$' and not is_reserved_handle(h) and not exists (select 1 from profiles where handle = h)
$$;

-- Joining: the name must be a real one. Without it (an account made on the other site,
-- or a form that was tampered with) the handle stands in and the app asks for the name.
-- The start of the e-mail address is never used any more: it made addresses public.
create or replace function join_politique(meta jsonb default null) returns boolean
language plpgsql security definer set search_path = politique, extensions, public as $$
declare
  uid uuid := auth.uid();
  u record;
  m jsonb;
  h text;
  n text;
begin
  if uid is null then return false; end if;
  if exists (select 1 from profiles where id = uid) then return false; end if;
  select id, email, phone, raw_user_meta_data into u from auth.users where id = uid;
  if not found then return false; end if;
  if (not setting_bool('signups_open') or setting_bool('maintenance', false))
     and not exists (select 1 from owner_claims where email = lower(u.email)) then
    return false;
  end if;
  m := coalesce(meta, case when u.raw_user_meta_data->>'app' = 'politique' then u.raw_user_meta_data end, '{}'::jsonb);
  h := lower(coalesce(m->>'handle', ''));
  if h !~ '^[a-z0-9_]{3,20}$' or is_reserved_handle(h) or exists (select 1 from profiles where handle = h) then
    h := 'u' || substr(replace(uid::text, '-', ''), 1, 12);
  end if;
  n := clean_display_name(m->>'display_name');
  insert into profiles (id, handle, display_name, lang, needs_name)
  values (uid, h, case when valid_display_name(n) then n else h end,
          case when m->>'lang' = 'en' then 'en' else 'fr' end,
          not valid_display_name(n));
  insert into private_profiles (user_id, vote_region_id, vote_department_id, vote_commune_id, vote_locality, is_registered_voter, phone)
  values (uid,
          nullif(m->>'vote_region_id', '')::smallint,
          nullif(m->>'vote_department_id', '')::smallint,
          nullif(m->>'vote_commune_id', '')::smallint,
          left(nullif(m->>'vote_locality', ''), 100),
          case when m ? 'is_registered_voter' then (m->>'is_registered_voter')::boolean else null end,
          u.phone);
  return true;
end $$;

-- Existing members whose public name is the start of their e-mail address, or not a name:
-- the address part comes off now and they are asked for their name on their next visit.
update profiles p set display_name = p.handle::text, needs_name = true
from auth.users u
where u.id = p.id and not p.is_owner
  and (lower(p.display_name) = lower(split_part(u.email, '@', 1)) or not valid_display_name(p.display_name));

-- ---------------------------------------------------------------------------
-- 2. Columns only the system writes
-- ---------------------------------------------------------------------------
-- The creation date is always "now" for members: a back-dated row slipped past the rate limits.
create or replace function trg_created_now() returns trigger
language plpgsql set search_path = politique, extensions, public as $$
begin
  if is_untrusted() then new.created_at := now(); end if;
  return new;
end $$;
do $$
declare t text;
begin
  foreach t in array array['posts', 'messages', 'reports', 'follows', 'likes', 'reposts', 'interpellations',
                           'propositions', 'conversations', 'verification_requests', 'promises', 'promise_updates',
                           'poll_votes', 'barometer_votes', 'interpellation_votes', 'proposition_votes', 'bookmarks'] loop
    execute format('drop trigger if exists a_created_now on politique.%I', t);
    execute format('create trigger a_created_now before insert on politique.%I for each row execute function politique.trg_created_now()', t);
  end loop;
end $$;

-- Posts: a new post starts with no likes, views or replies, visible, not deleted.
create or replace function trg_posts_before() returns trigger language plpgsql security definer set search_path = politique, extensions, public as $$
declare p posts%rowtype; tags text[]; mentions_arr uuid[]; trusted boolean := request_role() = 'service_role';
begin
  if tg_op = 'INSERT' then
    if new.parent_id is not null then
      select * into p from posts where id = new.parent_id;
      new.root_id := coalesce(p.root_id, p.id);
    else
      new.root_id := null;
    end if;
    if not trusted then
      new.link := null;        -- previews are fetched and attached by the server afterwards
      new.is_pinned := false;
      new.edited_at := null;
      new.reply_count := 0; new.like_count := 0; new.repost_count := 0; new.quote_count := 0;
      new.bookmark_count := 0; new.view_count := 0;
      new.is_hidden := false; new.deleted_at := null;
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
  select coalesce(array_agg(distinct lower(m[1])), '{}') into tags
  from regexp_matches(new.text, '(?:^|[^\w])#([[:alnum:]_]{2,50})', 'g') as m;
  new.hashtags := tags;
  select coalesce(array_agg(distinct pr.id), '{}') into mentions_arr
  from regexp_matches(new.text, '(?:^|[^\w])@([a-z0-9_]{3,20})', 'gi') as m
  join profiles pr on pr.handle = lower(m[1]);
  new.mentions := mentions_arr;
  return new;
end $$;

-- Polls start empty and last at most seven days.
create or replace function trg_polls_before() returns trigger language plpgsql set search_path = politique, extensions, public as $$
begin
  if is_untrusted() then
    new.counts := '{0,0,0,0}'; new.votes_count := 0;
    new.ends_at := least(new.ends_at, now() + interval '7 days 1 hour');
  end if;
  return new;
end $$;
drop trigger if exists polls_before on polls;
create trigger polls_before before insert on polls for each row execute function trg_polls_before();

-- Interpellations: start open with no votes. Afterwards the official (or a moderator)
-- answers or closes it; the author may only close their own.
revoke update on interpellations from authenticated, anon;
grant update (status, answer_post_id) on interpellations to authenticated;
create or replace function trg_interpellations_guard() returns trigger
language plpgsql security definer set search_path = politique, extensions, public as $$
declare me uuid := auth.uid(); official boolean;
begin
  if not is_untrusted() or pg_trigger_depth() > 1 then return new; end if;
  if tg_op = 'INSERT' then
    new.upvotes_count := 0; new.status := 'ouverte'; new.answer_post_id := null; new.answered_at := null;
    return new;
  end if;
  official := is_moderator() or exists (select 1 from officials o where o.id = old.official_id and (o.profile_id = me or o.personal_profile_id = me));
  if official then
    if new.answer_post_id is distinct from old.answer_post_id and new.answer_post_id is not null
       and not exists (select 1 from posts p where p.id = new.answer_post_id and p.author_id = me) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  elsif old.author_id = me then
    if new.answer_post_id is distinct from old.answer_post_id
       or (new.status is distinct from old.status and new.status <> 'classee') then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  else
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists interpellations_guard on interpellations;
create trigger interpellations_guard before insert or update on interpellations for each row execute function trg_interpellations_guard();
alter policy interp_official on interpellations using (
  exists (select 1 from officials o where o.id = official_id and (o.profile_id = (select auth.uid()) or o.personal_profile_id = (select auth.uid())))
  or (select politique.is_moderator()));

-- Idea box: starts new with no votes; only the commune's officials or a moderator answer.
revoke update on propositions from authenticated, anon;
grant update (status, response_post_id) on propositions to authenticated;
alter policy propositions_update on propositions using (
  (select politique.is_moderator()) or exists (select 1 from officials o where o.commune_id = propositions.commune_id
    and (o.profile_id = (select auth.uid()) or o.personal_profile_id = (select auth.uid()))))
  with check (
  (select politique.is_moderator()) or exists (select 1 from officials o where o.commune_id = propositions.commune_id
    and (o.profile_id = (select auth.uid()) or o.personal_profile_id = (select auth.uid()))));
create or replace function trg_propositions_before() returns trigger language plpgsql set search_path = politique, extensions, public as $$
begin
  if is_untrusted() then new.votes_count := 0; new.status := 'nouvelle'; new.response_post_id := null; end if;
  return new;
end $$;
drop trigger if exists propositions_before on propositions;
create trigger propositions_before before insert on propositions for each row execute function trg_propositions_before();

-- Promises: anyone may record one, it starts "announced" and unchecked. Only the status
-- changes afterwards, and "checked by" can only ever be the person checking.
revoke update on promises from authenticated, anon;
grant update (status, status_note, verified_by) on promises to authenticated;
alter policy promises_update on promises
  using ((select politique.is_moderator()) or (select politique.is_verified_media())
         or exists (select 1 from officials o where o.id = official_id and o.profile_id = (select auth.uid())))
  with check ((select politique.is_moderator()) or (select politique.is_verified_media())
         or exists (select 1 from officials o where o.id = official_id and o.profile_id = (select auth.uid())));
create or replace function trg_promises_guard() returns trigger language plpgsql set search_path = politique, extensions, public as $$
begin
  if not is_untrusted() then return new; end if;
  if tg_op = 'INSERT' then
    new.status := 'annoncee'; new.status_note := null; new.verified_by := null;
  elsif new.verified_by is distinct from old.verified_by and new.verified_by is distinct from auth.uid() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists promises_guard on promises;
create trigger promises_guard before insert or update on promises for each row execute function trg_promises_guard();

-- Notifications: a member only marks them read.
revoke update on notifications from authenticated, anon;
grant update (read_at) on notifications to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Conversations: membership only through the database's own functions
-- ---------------------------------------------------------------------------
-- Changing conversation_id on one's own membership row made you a member of any conversation.
revoke update on conversation_members from authenticated, anon;
grant update (last_read_at, muted) on conversation_members to authenticated;
-- A message can be deleted by its sender, never moved to another conversation.
revoke update on messages from authenticated, anon;
grant update (deleted_at) on messages to authenticated;
-- Conversations and members are created by get_or_create_dm() and create_group(), which
-- check blocks and the members list. Writing them directly let a creator add anyone.
drop policy if exists members_insert on conversation_members;
drop policy if exists conversations_insert on conversations;
revoke insert on conversations, conversation_members from authenticated, anon;

-- ---------------------------------------------------------------------------
-- 4 and 6. Official accounts, the directory and Découvertes: owner and admins only
-- ---------------------------------------------------------------------------
-- Admins are named by the owner alone (owner_set_role), so "admin" means "recognised by the owner".
drop policy if exists officials_self on officials;
alter policy officials_mod on officials using ((select politique.is_admin())) with check ((select politique.is_admin()));
alter policy official_areas_mod on official_areas using ((select politique.is_admin())) with check ((select politique.is_admin()));

create or replace function review_verification(rid uuid, approve boolean, note text default null) returns void
language plpgsql security definer set search_path = politique, extensions, public as $$
declare r verification_requests%rowtype;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select * into r from verification_requests where id = rid for update;
  if not found then raise exception 'not_found'; end if;
  update verification_requests set status = case when approve then 'approved' else 'rejected' end::verification_status,
         reviewed_by = auth.uid(), reviewed_at = now(), notes = note where id = rid;
  if approve then
    update profiles set verified = true, verified_at = now(), account_type = r.requested_type where id = r.user_id;
    if r.official_id is not null then
      if r.link_kind = 'personal' then
        update officials set personal_profile_id = r.user_id where id = r.official_id;
      else
        update officials set profile_id = r.user_id, claimed_at = now() where id = r.official_id;
      end if;
    end if;
    insert into moderation_actions (moderator_id, target_user_id, action) values (auth.uid(), r.user_id, 'verify');
  end if;
  insert into notifications (user_id, actor_id, type) values (r.user_id, null, 'verification');
end $$;

-- A request is always sent pending, with the requester's own documents.
alter policy verif_insert on verification_requests with check (
  user_id = (select auth.uid()) and status = 'pending' and reviewed_by is null and reviewed_at is null and notes is null
  and (document_path is null or document_path like (select auth.uid())::text || '/%')
  and (proof_path is null or proof_path like (select auth.uid())::text || '/%'));
alter policy verif_mod on verification_requests using ((select politique.is_admin())) with check ((select politique.is_admin()));
alter policy verif_own on verification_requests using (user_id = (select auth.uid()) or (select politique.is_admin()));
-- Identity documents: their owner, and the owner and admins who check them.
alter policy politique_documents_own on storage.objects
  using (bucket_id = 'politique-documents' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select politique.is_admin())))
  with check (bucket_id = 'politique-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Découvertes: the commune's mayor (an account the owner or an admin verified and linked) or an admin.
create or replace function can_edit_showcase(cid smallint) returns boolean
language sql stable security definer set search_path = politique, extensions, public as $$
  select auth.uid() is not null and (
    is_admin() or exists (
      select 1 from officials o
      where o.mandate = 'maire' and o.commune_id = cid and not o.vacant
        and (o.profile_id = auth.uid() or o.personal_profile_id = auth.uid())
    )
  )
$$;

-- ---------------------------------------------------------------------------
-- 5. Reports are sent open
-- ---------------------------------------------------------------------------
alter policy reports_insert on reports with check (
  reporter_id = (select auth.uid()) and status = 'open' and reviewed_by is null and reviewed_at is null);

-- ---------------------------------------------------------------------------
-- 8. Account search: name or handle, accents and case ignored, any order, small typos
-- ---------------------------------------------------------------------------
create or replace function search_key(t text) returns text
language sql immutable parallel safe set search_path = politique, extensions, public as $$
  select btrim(regexp_replace(lower(f_unaccent(coalesce(t, ''))), '[^a-z0-9_]+', ' ', 'g'))
$$;
create index if not exists profiles_search_name_trgm on profiles using gin (search_key(display_name) gin_trgm_ops);

create or replace function search_profiles(q text, lim int default 10)
returns setof profiles
language sql stable security definer set search_path = politique, extensions, public as $$
  with k as (
    select search_key(left(q, 100)) as s
  ), w as (
    select s, replace(s, ' ', '') as joined, array_remove(string_to_array(s, ' '), '') as words from k
  )
  select p.* from profiles p, w
  where p.deleted_at is null and w.s <> ''
    and (
      -- every word appears in the name or the handle ("kone awa", "awa", "@awakone", "Koné")
      not exists (select 1 from unnest(w.words) x
                  where strpos(search_key(p.display_name) || ' ' || p.handle::text, x) = 0)
      or p.handle::text like w.joined || '%'
      -- small typos ("Kouame" for "Kouamé Konan", "ulric")
      or (char_length(w.s) >= 3 and (similarity(search_key(p.display_name), w.s) >= 0.3
                                      or similarity(p.handle::text, w.joined) >= 0.4))
    )
  order by (p.handle::text = w.joined) desc,
           (search_key(p.display_name) = w.s) desc,
           (p.handle::text like w.joined || '%' or search_key(p.display_name) like w.s || '%') desc,
           greatest(similarity(search_key(p.display_name), w.s), similarity(p.handle::text, w.joined)) desc,
           p.verified desc, p.followers_count desc
  limit least(greatest(coalesce(lim, 10), 1), 50)
$$;

grant execute on function is_untrusted(), clean_display_name(text), valid_display_name(text), is_reserved_handle(text),
  search_key(text) to anon, authenticated, service_role;
revoke execute on function trg_created_now(), trg_polls_before(), trg_interpellations_guard(), trg_propositions_before(),
  trg_promises_guard(), trg_profiles_name() from public, anon, authenticated;
