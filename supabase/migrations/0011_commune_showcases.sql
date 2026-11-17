-- Découvertes: each commune's showcase page. The editorial content (sites, culture,
-- products, events, photos and their sources) ships with the app (data/communes);
-- this table holds what the town hall adds itself: a short tagline, the mayor's word,
-- the next event and the town hall's website. One row per commune, written by the
-- mayor's office account, the mayor's linked personal account, or a moderator.
set search_path = politique, extensions, public;

create table if not exists commune_showcases (
  commune_id  smallint primary key references ci_communes(id),
  tagline     text check (char_length(tagline) <= 90),
  message     text check (char_length(message) <= 700),
  event_title text check (char_length(event_title) <= 90),
  event_date  date,
  event_text  text check (char_length(event_text) <= 300),
  website     text check (website ~ '^https://[^\s]+$' and char_length(website) <= 200),
  updated_by  uuid references profiles(id) on delete set null,
  updated_at  timestamptz not null default now()
);

-- Who may edit a commune's showcase: its mayor (office or linked personal account) or a moderator.
create or replace function can_edit_showcase(cid smallint) returns boolean
language sql stable security definer set search_path = politique, extensions, public as $$
  select auth.uid() is not null and (
    is_moderator() or exists (
      select 1 from officials o
      where o.mandate = 'maire' and o.commune_id = cid and not o.vacant
        and (o.profile_id = auth.uid() or o.personal_profile_id = auth.uid())
    )
  )
$$;

alter table commune_showcases enable row level security;
drop policy if exists commune_showcases_read on commune_showcases;
create policy commune_showcases_read on commune_showcases for select using (true);
drop policy if exists commune_showcases_write on commune_showcases;
create policy commune_showcases_write on commune_showcases for insert with check (can_edit_showcase(commune_id) and updated_by = auth.uid());
drop policy if exists commune_showcases_update on commune_showcases;
create policy commune_showcases_update on commune_showcases for update using (can_edit_showcase(commune_id)) with check (can_edit_showcase(commune_id) and updated_by = auth.uid());
grant select on commune_showcases to anon, authenticated;
grant insert, update on commune_showcases to authenticated;
grant all on commune_showcases to service_role;
grant execute on function can_edit_showcase(smallint) to anon, authenticated;
