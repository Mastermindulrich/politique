-- Owner control center: an owner role above admins, site-wide switches,
-- member management functions and an audit log.
-- The owner's e-mail is never stored in this file: it goes into politique.owner_claims
-- by hand (SQL editor), and whoever joins POLITIQUE with that e-mail becomes owner.
set search_path = politique, extensions, public;

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
alter table profiles add column if not exists is_owner boolean not null default false;

create table if not exists owner_claims (email text primary key check (email = lower(email)));
alter table owner_claims enable row level security;
-- Row level security with no policy: nobody reads or writes it through the API.

create or replace function is_owner() returns boolean
language sql stable security definer set search_path = politique, extensions, public as $$
  select coalesce((select is_owner from profiles where id = auth.uid() and deleted_at is null), false)
$$;
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = politique, extensions, public as $$
  select coalesce((select is_admin or is_owner from profiles where id = auth.uid()), false)
$$;
create or replace function is_moderator() returns boolean
language sql stable security definer set search_path = politique, extensions, public as $$
  select coalesce((select is_admin or is_moderator or is_owner from profiles where id = auth.uid()), false)
$$;

-- New profiles: is_owner only ever comes from owner_claims, never from the client.
create or replace function trg_profiles_owner_claim() returns trigger
language plpgsql security definer set search_path = politique, extensions, public as $$
begin
  new.is_owner := exists (
    select 1 from auth.users u join owner_claims c on c.email = lower(u.email) where u.id = new.id);
  return new;
end $$;
create trigger profiles_owner_claim before insert on profiles for each row execute function trg_profiles_owner_claim();

-- Role and sanction columns can only change through the rules below, whatever the policy.
-- Only requests made as a signed-in or anonymous visitor are checked: SQL run by the
-- project itself (SQL editor, service role) is trusted.
create or replace function trg_profiles_guard() returns trigger
language plpgsql security definer set search_path = politique, extensions, public as $$
declare me uuid := auth.uid();
begin
  if me is null or coalesce(current_setting('role', true), 'none') not in ('authenticated', 'anon') then return new; end if;
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
create trigger profiles_guard before update on profiles for each row execute function trg_profiles_guard();

-- ---------------------------------------------------------------------------
-- Site settings (public read, owner write)
-- ---------------------------------------------------------------------------
create table if not exists site_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id) on delete set null
);
alter table site_settings enable row level security;
create policy site_settings_read on site_settings for select using (true);

insert into site_settings (key, value) values
  ('signups_open', 'true'), ('posting', 'true'), ('interactions', 'true'), ('messages', 'true'),
  ('interpellations', 'true'), ('promises', 'true'), ('ideas', 'true'), ('barometer', 'true'),
  ('media_uploads', 'true'), ('verification_requests', 'true'), ('maintenance', 'false'),
  ('announcement', '{"fr": "", "en": "", "tone": "info"}')
on conflict (key) do nothing;

create or replace function setting_bool(k text, fallback boolean default true) returns boolean
language sql stable security definer set search_path = politique, extensions, public as $$
  select coalesce((select case jsonb_typeof(value) when 'boolean' then value::text::boolean end from site_settings where key = k), fallback)
$$;

-- A feature is usable when it is switched on and the site is not in maintenance.
-- Owner and admins keep every feature, so they can test and clean up.
create or replace function feature_allowed(k text) returns boolean
language sql stable security definer set search_path = politique, extensions, public as $$
  select is_admin() or (setting_bool(k) and not setting_bool('maintenance', false))
$$;

-- Switches are enforced in the database, not only hidden in the interface.
do $$
declare r record;
begin
  for r in select * from (values
    ('posts', 'posting'), ('polls', 'posting'),
    ('likes', 'interactions'), ('reposts', 'interactions'), ('follows', 'interactions'), ('poll_votes', 'interactions'),
    ('conversations', 'messages'), ('messages', 'messages'),
    ('interpellations', 'interpellations'), ('interpellation_votes', 'interpellations'),
    ('promises', 'promises'), ('promise_updates', 'promises'),
    ('propositions', 'ideas'), ('proposition_votes', 'ideas'),
    ('barometer_votes', 'barometer'),
    ('verification_requests', 'verification_requests')
  ) as t(tbl, feat) loop
    execute format('create policy %I on politique.%I as restrictive for insert to authenticated with check (politique.feature_allowed(%L))',
                   'switch_' || r.tbl, r.tbl, r.feat);
  end loop;
end $$;

alter policy politique_media_write on storage.objects with check (
  bucket_id = 'politique-media' and auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text
  and politique.feature_allowed('media_uploads'));

-- Joining POLITIQUE respects the sign-up switch (the owner can always join).
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
  if (not setting_bool('signups_open') or setting_bool('maintenance', false))
     and not exists (select 1 from owner_claims where email = lower(u.email)) then
    return false;
  end if;
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

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------
create table if not exists admin_log (
  id             bigint generated always as identity primary key,
  actor_id       uuid references profiles(id) on delete set null,
  action         text not null,
  target_user_id uuid references profiles(id) on delete set null,
  details        jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists admin_log_time on admin_log (created_at desc);
alter table admin_log enable row level security;
create policy admin_log_read on admin_log for select using (is_admin());

-- ---------------------------------------------------------------------------
-- Control center functions
-- ---------------------------------------------------------------------------
create or replace function owner_set_setting(k text, v jsonb) returns void
language plpgsql security definer set search_path = politique, extensions, public as $$
begin
  if not is_owner() then raise exception 'forbidden'; end if;
  if k not in ('signups_open','posting','interactions','messages','interpellations','promises','ideas','barometer',
               'media_uploads','verification_requests','maintenance','announcement') then raise exception 'invalid'; end if;
  if k = 'announcement' then
    if jsonb_typeof(v) <> 'object' or length(coalesce(v->>'fr','')) > 280 or length(coalesce(v->>'en','')) > 280
       or coalesce(v->>'tone','info') not in ('info','warning') then raise exception 'invalid'; end if;
  elsif jsonb_typeof(v) <> 'boolean' then raise exception 'invalid';
  end if;
  insert into site_settings (key, value, updated_at, updated_by) values (k, v, now(), auth.uid())
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
  insert into admin_log (actor_id, action, details) values (auth.uid(), 'setting', jsonb_build_object('key', k, 'value', v));
end $$;

-- role: 'member' | 'moderator' | 'admin'
create or replace function owner_set_role(uid uuid, role text) returns void
language plpgsql security definer set search_path = politique, extensions, public as $$
begin
  if not is_owner() then raise exception 'forbidden'; end if;
  if role not in ('member','moderator','admin') then raise exception 'invalid'; end if;
  if exists (select 1 from profiles where id = uid and is_owner) then raise exception 'forbidden'; end if;
  update profiles set is_admin = (role = 'admin'), is_moderator = (role = 'moderator') where id = uid;
  if not found then raise exception 'not_found'; end if;
  insert into admin_log (actor_id, action, target_user_id, details) values (auth.uid(), 'role', uid, jsonb_build_object('role', role));
end $$;

create or replace function admin_set_badge(uid uuid, on_off boolean) returns void
language plpgsql security definer set search_path = politique, extensions, public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  update profiles set verified = on_off where id = uid;
  if not found then raise exception 'not_found'; end if;
  insert into admin_log (actor_id, action, target_user_id, details) values (auth.uid(), 'badge', uid, jsonb_build_object('verified', on_off));
end $$;

-- Records a member created for others stay; the link to them is cleared first,
-- or handed to the person removing them where the column cannot be empty.
create or replace function detach_member(uid uuid, heir uuid) returns void
language plpgsql security definer set search_path = politique, extensions, public as $$
begin
  -- Callable by the owner, or by the project itself (service role); never by visitors.
  if coalesce(current_setting('role', true), 'none') in ('authenticated', 'anon') and not is_owner() then raise exception 'forbidden'; end if;
  update officials set created_by = null where created_by = uid;
  update post_labels set labeled_by = heir where labeled_by = uid;
  update conversations set created_by = null where created_by = uid;
  update reports set reviewed_by = null where reviewed_by = uid;
  update verification_requests set reviewed_by = null where reviewed_by = uid;
  update promises set verified_by = null where verified_by = uid;
  update barometers set created_by = null where created_by = uid;
  update moderation_actions set moderator_id = heir where moderator_id = uid;
  update promises set created_by = heir where created_by = uid;
end $$;

-- Removes the person's POLITIQUE profile and everything attached to it.
-- Their login is shared with Prototype X and stays untouched.
create or replace function owner_remove_member(uid uuid) returns void
language plpgsql security definer set search_path = politique, extensions, public as $$
begin
  if not is_owner() then raise exception 'forbidden'; end if;
  if uid = auth.uid() or exists (select 1 from profiles where id = uid and is_owner) then raise exception 'forbidden'; end if;
  insert into admin_log (actor_id, action, details)
  select auth.uid(), 'remove_member', jsonb_build_object('handle', handle, 'display_name', display_name) from profiles where id = uid;
  perform detach_member(uid, auth.uid());
  delete from profiles where id = uid;
end $$;

create or replace function admin_stats() returns jsonb
language plpgsql stable security definer set search_path = politique, extensions, public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'members',        (select count(*) from profiles where deleted_at is null),
    'members_7d',     (select count(*) from profiles where deleted_at is null and created_at > now() - interval '7 days'),
    'members_24h',    (select count(*) from profiles where deleted_at is null and created_at > now() - interval '1 day'),
    'posts',          (select count(*) from posts where deleted_at is null),
    'posts_24h',      (select count(*) from posts where deleted_at is null and created_at > now() - interval '1 day'),
    'messages_24h',   (select count(*) from messages where created_at > now() - interval '1 day'),
    'open_reports',   (select count(*) from reports where status in ('open','reviewing')),
    'pending_verifs', (select count(*) from verification_requests where status = 'pending'),
    'officials',      (select count(*) from officials),
    'suspended',      (select count(*) from profiles where suspended_until > now()),
    'staff',          (select count(*) from profiles where is_admin or is_moderator or is_owner)
  );
end $$;

-- Member list for the control center. Never returns where people vote.
-- The e-mail address is only returned to the owner.
create or replace function admin_members(q text default null, filter text default 'all', lim int default 50, off int default 0)
returns table (id uuid, handle text, display_name text, avatar_url text, account_type text, verified boolean,
               is_owner boolean, is_admin boolean, is_moderator boolean, suspended_until timestamptz,
               posts_count int, followers_count int, created_at timestamptz, email text, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = politique, extensions, public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  return query
  select p.id, p.handle::text, p.display_name, p.avatar_url, p.account_type::text, p.verified,
         p.is_owner, p.is_admin, p.is_moderator, p.suspended_until, p.posts_count, p.followers_count, p.created_at,
         case when is_owner() then u.email::text end, u.last_sign_in_at
  from profiles p left join auth.users u on u.id = p.id
  where p.deleted_at is null
    and (q is null or q = '' or p.handle::text ilike '%' || q || '%' or p.display_name ilike '%' || q || '%'
         or (is_owner() and u.email ilike '%' || q || '%'))
    and case filter
          when 'staff' then p.is_owner or p.is_admin or p.is_moderator
          when 'suspended' then p.suspended_until > now()
          when 'verified' then p.verified
          else true end
  order by p.created_at desc
  limit least(greatest(lim, 1), 200) offset greatest(off, 0);
end $$;

revoke execute on function detach_member(uuid, uuid) from public, anon, authenticated;
grant execute on function detach_member(uuid, uuid) to service_role;
revoke execute on function owner_set_setting(text, jsonb), owner_set_role(uuid, text), admin_set_badge(uuid, boolean),
  owner_remove_member(uuid), admin_stats(), admin_members(text, text, int, int) from public, anon;
grant execute on function owner_set_setting(text, jsonb), owner_set_role(uuid, text), admin_set_badge(uuid, boolean),
  owner_remove_member(uuid), admin_stats(), admin_members(text, text, int, int) to authenticated;
grant select on site_settings to anon, authenticated;
grant select on admin_log to authenticated;
grant execute on function is_owner(), setting_bool(text, boolean), feature_allowed(text) to anon, authenticated;
