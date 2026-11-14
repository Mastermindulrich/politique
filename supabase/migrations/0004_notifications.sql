-- POLITIQUE: notification preferences, posts from people you follow, Web Push.
--
-- What it adds:
--   * notification_prefs: per category, "in the app" and "on my devices (push)",
--     plus sound, message previews and quiet hours. A missing row means defaults.
--   * Every notification row now passes through one filter (prefs, blocks, mutes),
--     whatever trigger created it.
--   * following_post: a top-level post notifies the author's followers.
--   * push_subscriptions: one row per browser/phone that accepted push.
--   * After notifications are inserted, the ids worth pushing are posted to the
--     site's /api/push/dispatch route through pg_net, which sends the Web Push.
--     The route's URL and shared secret live in Supabase Vault
--     ('politique_push_url', 'politique_push_secret'). Without pg_net or those
--     secrets nothing is sent and nothing fails.

set search_path = politique, extensions, public;

alter type notification_type add value if not exists 'following_post';

-- ---------------------------------------------------------------------------
-- Preferences
-- ---------------------------------------------------------------------------
create table if not exists notification_prefs (
  user_id     uuid primary key references profiles(id) on delete cascade,
  inapp       jsonb not null default '{}'::jsonb,   -- { category: boolean }
  push        jsonb not null default '{}'::jsonb,   -- { category: boolean }
  sound       boolean not null default true,
  previews    boolean not null default true,        -- show message text in push
  quiet_start smallint check (quiet_start between 0 and 23),
  quiet_end   smallint check (quiet_end between 0 and 23),
  updated_at  timestamptz not null default now()
);

alter table notification_prefs enable row level security;
drop policy if exists notification_prefs_own on notification_prefs;
create policy notification_prefs_own on notification_prefs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Categories shown in Settings. Account notices (verification, moderation) are always on.
create or replace function notif_category(t notification_type) returns text
language sql immutable set search_path = politique, extensions, public as $$
  select case t::text
    when 'like' then 'likes'
    when 'repost' then 'reposts'
    when 'reply' then 'replies'
    when 'quote' then 'replies'
    when 'mention' then 'mentions'
    when 'follow' then 'follows'
    when 'following_post' then 'following_posts'
    when 'official_post' then 'official_posts'
    when 'message' then 'messages'
    when 'interpellation_answer' then 'civic'
    when 'poll_end' then 'civic'
    else 'account'
  end
$$;

-- Defaults when the member never touched the setting. Likes and reposts stay in the
-- app only; everything addressed to you also reaches your phone.
create or replace function notif_default(cat text, for_push boolean) returns boolean
language sql immutable set search_path = politique, extensions, public as $$
  select case
    when cat = 'account' then true
    when for_push and cat in ('likes', 'reposts') then false
    else true
  end
$$;

create or replace function notif_wanted(uid uuid, t notification_type, for_push boolean) returns boolean
language plpgsql stable security definer set search_path = politique, extensions, public as $$
declare p notification_prefs%rowtype; cat text := notif_category(t); v jsonb; h int;
begin
  if cat = 'account' then return true; end if;
  select * into p from notification_prefs where user_id = uid;
  if not found then return notif_default(cat, for_push); end if;
  -- Push needs the in-app setting too: switching a category off silences it everywhere.
  v := p.inapp -> cat;
  if v is not null and jsonb_typeof(v) = 'boolean' and not v::text::boolean then return false; end if;
  if for_push then
    v := p.push -> cat;
    if v is not null and jsonb_typeof(v) = 'boolean' then
      if not v::text::boolean then return false; end if;
    elsif not notif_default(cat, true) then
      return false;
    end if;
    -- Quiet hours, Abidjan time (UTC+0). Start 22, end 7 = 22:00 to 06:59.
    if p.quiet_start is not null and p.quiet_end is not null and p.quiet_start <> p.quiet_end then
      h := extract(hour from now() at time zone 'Africa/Abidjan');
      if (p.quiet_start < p.quiet_end and h >= p.quiet_start and h < p.quiet_end)
        or (p.quiet_start > p.quiet_end and (h >= p.quiet_start or h < p.quiet_end)) then
        return false;
      end if;
    end if;
  end if;
  return true;
end $$;

-- ---------------------------------------------------------------------------
-- One gate for every notification: preferences, blocks, mutes.
-- ---------------------------------------------------------------------------
create or replace function trg_notifications_filter() returns trigger
language plpgsql security definer set search_path = politique, extensions, public as $$
begin
  if new.actor_id is not null and notif_category(new.type) <> 'account' then
    if new.actor_id = new.user_id then return null; end if;
    if exists (select 1 from blocks where (blocker_id = new.user_id and blocked_id = new.actor_id)
                                       or (blocker_id = new.actor_id and blocked_id = new.user_id)) then
      return null;
    end if;
    if new.type <> 'message' and exists (select 1 from mutes where muter_id = new.user_id and muted_id = new.actor_id) then
      return null;
    end if;
  end if;
  if not notif_wanted(new.user_id, new.type, false) then return null; end if;
  return new;
end $$;
drop trigger if exists notifications_filter on notifications;
create trigger notifications_filter before insert on notifications for each row execute function trg_notifications_filter();

-- ---------------------------------------------------------------------------
-- Posts from people you follow (top-level posts only; replies stay quiet).
-- Runs after posts_after (trigger order is alphabetical), so someone who already
-- got "your official posted" for the same post is not told twice.
-- ---------------------------------------------------------------------------
create or replace function trg_posts_notify_followers() returns trigger
language plpgsql security definer set search_path = politique, extensions, public as $$
begin
  if new.kind = 'post' and new.deleted_at is null then
    insert into notifications (user_id, actor_id, type, post_id)
    select f.follower_id, new.author_id, 'following_post'::notification_type, new.id
    from follows f
    where f.followee_id = new.author_id
      and not exists (select 1 from notifications n where n.user_id = f.follower_id and n.post_id = new.id)
    limit 50000;
  end if;
  return new;
end $$;
drop trigger if exists posts_notify_followers on posts;
create trigger posts_notify_followers after insert on posts for each row execute function trg_posts_notify_followers();

-- ---------------------------------------------------------------------------
-- Push subscriptions (Web Push, one row per browser or installed app)
-- ---------------------------------------------------------------------------
create table if not exists push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists push_subscriptions_user on push_subscriptions(user_id);

alter table push_subscriptions enable row level security;
drop policy if exists push_subscriptions_own_read on push_subscriptions;
drop policy if exists push_subscriptions_own_delete on push_subscriptions;
create policy push_subscriptions_own_read on push_subscriptions for select using (user_id = auth.uid());
create policy push_subscriptions_own_delete on push_subscriptions for delete using (user_id = auth.uid());

-- A browser belongs to whoever subscribed last on it (shared phone, change of account).
create or replace function save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void language plpgsql security definer set search_path = politique, extensions, public as $$
begin
  if auth.uid() is null or not exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'not a member';
  end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 1000 or length(p_p256dh) > 200 or length(p_auth) > 100 then
    raise exception 'invalid subscription';
  end if;
  insert into push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, created_at = now();
end $$;

create or replace function delete_push_subscription(p_endpoint text) returns void
language sql security definer set search_path = politique, extensions, public as $$
  delete from push_subscriptions where endpoint = p_endpoint and user_id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- Hand the new notifications to the push sender.
-- Statement level: one fan-out of 10,000 rows costs a few HTTP calls, not 10,000.
-- ---------------------------------------------------------------------------
create or replace function trg_notifications_push() returns trigger
language plpgsql security definer set search_path = politique, extensions, public as $$
declare ids uuid[]; chunk uuid[]; url text; secret text; i int;
begin
  if to_regnamespace('net') is null or to_regclass('vault.decrypted_secrets') is null then return null; end if;
  select array_agg(n.id) into ids
  from new_rows n
  where exists (select 1 from push_subscriptions s where s.user_id = n.user_id)
    and notif_wanted(n.user_id, n.type, true);
  if ids is null then return null; end if;
  execute $q$select (select decrypted_secret from vault.decrypted_secrets where name = 'politique_push_url' limit 1),
                    (select decrypted_secret from vault.decrypted_secrets where name = 'politique_push_secret' limit 1)$q$
    into url, secret;
  if url is null or secret is null then return null; end if;
  i := 1;
  while i <= array_length(ids, 1) loop
    chunk := ids[i:i + 499];
    execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 8000)'
      using url, jsonb_build_object('ids', to_jsonb(chunk)),
            jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret);
    i := i + 500;
  end loop;
  return null;
exception when others then
  -- Never let push delivery break a like, a post or a message.
  raise warning 'push dispatch skipped: %', sqlerrm;
  return null;
end $$;
drop trigger if exists notifications_push on notifications;
create trigger notifications_push after insert on notifications
  referencing new table as new_rows for each statement execute function trg_notifications_push();

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on notification_prefs to authenticated;
grant select, delete on push_subscriptions to authenticated;
grant all on notification_prefs, push_subscriptions to service_role;
revoke all on notification_prefs, push_subscriptions from anon;
revoke insert, update on push_subscriptions from authenticated;
revoke execute on function save_push_subscription(text, text, text, text), delete_push_subscription(text) from anon;
grant execute on function save_push_subscription(text, text, text, text), delete_push_subscription(text) to authenticated;
revoke execute on function notif_wanted(uuid, notification_type, boolean) from public, anon, authenticated;
grant execute on function notif_wanted(uuid, notification_type, boolean) to service_role;
