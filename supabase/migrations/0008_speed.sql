-- POLITIQUE 0008: database speed-ups (no change to who can see or do what).
--
-- 1. Row level security policies (all but those of profiles, see below) call auth.uid(), is_moderator() and is_admin() once per
--    ROW today. Wrapped in a sub-select, Postgres computes them once per QUERY instead
--    (Supabase's own advice, "auth_rls_initplan"). A feed of 25 posts with 3 checks each
--    goes from ~75 function calls to 3. The rules themselves are unchanged: the policy text
--    is rewritten mechanically from what is in the database, so it also covers policies
--    added by earlier migrations. Safe to run more than once.
-- 2. Indexes on the foreign keys the app joins or filters on (Supabase advisor
--    "unindexed_foreign_keys"), so deleting a post or listing a member's votes stays fast
--    as the tables grow.

set search_path = politique, public;

do $$
declare
  p record;
  q text;
  c text;
  stmt text;
begin
  for p in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'politique'
      -- Not profiles: its update rule reads profiles again, and Postgres refuses ("infinite
      -- recursion") once the read rule it re-applies contains a sub-select.
      and tablename <> 'profiles'
      and (coalesce(qual, '') ~ 'auth\.uid\(\)|is_moderator\(\)|is_admin\(\)'
        or coalesce(with_check, '') ~ 'auth\.uid\(\)|is_moderator\(\)|is_admin\(\)')
  loop
    q := p.qual;
    c := p.with_check;
    -- Undo an earlier wrap first (Postgres stores it as "( SELECT auth.uid() AS uid)"),
    -- so a second run gives the same text instead of nesting selects.
    q := regexp_replace(q, '\(\s*SELECT auth\.uid\(\) AS uid\)', 'auth.uid()', 'gi');
    q := regexp_replace(q, '\(\s*SELECT (politique\.)?is_moderator\(\) AS is_moderator\)', 'politique.is_moderator()', 'gi');
    q := regexp_replace(q, '\(\s*SELECT (politique\.)?is_admin\(\) AS is_admin\)', 'politique.is_admin()', 'gi');
    c := regexp_replace(c, '\(\s*SELECT auth\.uid\(\) AS uid\)', 'auth.uid()', 'gi');
    c := regexp_replace(c, '\(\s*SELECT (politique\.)?is_moderator\(\) AS is_moderator\)', 'politique.is_moderator()', 'gi');
    c := regexp_replace(c, '\(\s*SELECT (politique\.)?is_admin\(\) AS is_admin\)', 'politique.is_admin()', 'gi');
    -- Then wrap. Bare is_moderator()/is_admin() (written without the schema) are covered too.
    q := regexp_replace(q, 'auth\.uid\(\)', '(select auth.uid())', 'g');
    q := regexp_replace(q, '(politique\.)?is_moderator\(\)', '(select politique.is_moderator())', 'g');
    q := regexp_replace(q, '(politique\.)?is_admin\(\)', '(select politique.is_admin())', 'g');
    c := regexp_replace(c, 'auth\.uid\(\)', '(select auth.uid())', 'g');
    c := regexp_replace(c, '(politique\.)?is_moderator\(\)', '(select politique.is_moderator())', 'g');
    c := regexp_replace(c, '(politique\.)?is_admin\(\)', '(select politique.is_admin())', 'g');
    stmt := format('alter policy %I on politique.%I', p.policyname, p.tablename);
    if q is not null then stmt := stmt || format(' using (%s)', q); end if;
    if c is not null then stmt := stmt || format(' with check (%s)', c); end if;
    execute stmt;
  end loop;
end $$;

create index if not exists bookmarks_post on bookmarks(post_id);
create index if not exists posts_quoted on posts(quoted_id) where quoted_id is not null;
create index if not exists notifications_actor on notifications(actor_id);
create index if not exists notifications_post on notifications(post_id) where post_id is not null;
create index if not exists blocks_blocked on blocks(blocked_id);
create index if not exists mutes_muted on mutes(muted_id);
create index if not exists poll_votes_user on poll_votes(user_id);
create index if not exists barometer_votes_user on barometer_votes(user_id);
create index if not exists interpellation_votes_user on interpellation_votes(user_id);
create index if not exists proposition_votes_user on proposition_votes(user_id);
create index if not exists interpellations_post on interpellations(post_id) where post_id is not null;
create index if not exists reports_post on reports(post_id) where post_id is not null;
create index if not exists moderation_actions_post on moderation_actions(post_id) where post_id is not null;
