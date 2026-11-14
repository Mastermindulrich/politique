-- Founder badge: the crown shown next to the owner's name everywhere.
-- The app shows it only when profiles.is_owner is true. 0003 already makes that column
-- impossible to set or change through the API (insert trigger reads owner_claims, update
-- guard refuses any change). This migration adds two more locks:
--   1. at most one owner can ever exist, enforced by a unique index;
--   2. nobody else can dress up as the founder: names and handles that use the badge's
--      words (fondateur, founder, owner, propriétaire) or a crown are refused.
set search_path = politique, extensions, public;

-- 1. A single owner, ever.
create unique index if not exists profiles_single_owner on profiles ((true)) where is_owner;

-- A second claimed e-mail joins as an ordinary member instead of failing on the index.
create or replace function trg_profiles_owner_claim() returns trigger
language plpgsql security definer set search_path = politique, extensions, public as $$
begin
  new.is_owner := exists (
    select 1 from auth.users u join owner_claims c on c.email = lower(u.email) where u.id = new.id)
    and not exists (select 1 from profiles where is_owner);
  return new;
end $$;

-- 2. Reserved words, for everyone but the owner.
create or replace function is_reserved_name(s text) returns boolean
language sql immutable set search_path = politique, extensions, public as $$
  select coalesce(
    s ~* '(fondat(eur|rice)|founder|owner|propri[eé]taire|proprio)'
    or s ~ '[👑♔♕♚♛]', false)
$$;

create or replace function trg_profiles_reserved_names() returns trigger
language plpgsql security definer set search_path = politique, extensions, public as $$
begin
  if new.is_owner then return new; end if;
  if tg_op = 'INSERT' then
    -- Never block a sign-up on the display name: fall back to the handle instead.
    if is_reserved_name(new.display_name) then new.display_name := new.handle::text; end if;
    if is_reserved_name(new.handle::text) then raise exception 'reserved_name'; end if;
  else
    if new.display_name is distinct from old.display_name and is_reserved_name(new.display_name) then
      raise exception 'reserved_name';
    end if;
    if new.handle is distinct from old.handle and is_reserved_name(new.handle::text) then
      raise exception 'reserved_name';
    end if;
  end if;
  return new;
end $$;
-- Runs after profiles_owner_claim (triggers fire in name order), so is_owner is already set.
drop trigger if exists profiles_reserved_names on profiles;
create trigger profiles_reserved_names before insert or update on profiles
  for each row execute function trg_profiles_reserved_names();

-- The sign-up form checks handles here first: reserved handles read as taken.
create or replace function handle_available(h text) returns boolean
language sql stable security definer set search_path = politique, extensions, public as $$
  select h ~ '^[a-z0-9_]{3,20}$' and not is_reserved_name(h) and not exists (select 1 from profiles where handle = h)
$$;
