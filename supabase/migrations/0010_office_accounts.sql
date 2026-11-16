-- Office accounts ("comptes de fonction"): one row in officials per public office,
-- named after its current holder, imported from official sources (data/officials).
-- Like X, an office account belongs to the office and passes to the next holder;
-- the holder can also link a personal account.
-- Needs 0009 (new mandate types) applied first.
set search_path = politique, extensions, public;

alter table officials
  add column if not exists office_key          text,
  add column if not exists institution         text,
  add column if not exists role                text,
  add column if not exists rank                integer not null default 1000,
  add column if not exists gender              text check (gender in ('F', 'M')),
  add column if not exists vacant              boolean not null default false,
  add column if not exists note                text,
  add column if not exists source_url          text,
  add column if not exists source_label        text,
  add column if not exists source_checked      date,
  add column if not exists personal_profile_id uuid references profiles(id) on delete set null;

create unique index if not exists officials_office_key on officials(office_key);
create index if not exists officials_institution_rank on officials(institution, rank, full_name);
create index if not exists officials_personal_profile on officials(personal_profile_id);

-- The communes a mandate covers when there are several (a deputy's constituency).
create table if not exists official_areas (
  official_id uuid not null references officials(id) on delete cascade,
  commune_id  smallint not null references ci_communes(id),
  primary key (official_id, commune_id)
);
create index if not exists official_areas_commune on official_areas(commune_id);
alter table official_areas enable row level security;
drop policy if exists official_areas_read on official_areas;
create policy official_areas_read on official_areas for select using (true);
drop policy if exists official_areas_mod on official_areas;
create policy official_areas_mod on official_areas for all using (is_moderator()) with check (is_moderator());
grant select on official_areas to anon, authenticated;
grant insert, update, delete on official_areas to authenticated;
grant all on official_areas to service_role;

-- A verification request can claim the office account itself, or link the
-- requester's personal account to it.
alter table verification_requests
  add column if not exists link_kind text not null default 'office' check (link_kind in ('office', 'personal'));

-- Does an office cover a voter registered in (commune, department, region)?
create or replace function official_covers(o officials, cid smallint, did smallint, rid smallint)
returns boolean
language sql stable security definer set search_path = politique, extensions, public as $$
  select case
    when exists (select 1 from official_areas a where a.official_id = o.id)
      then cid is not null and exists (select 1 from official_areas a where a.official_id = o.id and a.commune_id = cid)
    when o.mandate = 'depute' then false                          -- constituency not mapped to communes yet
    when o.mandate = 'sous_prefet' and o.commune_id is null then false
    when o.commune_id is not null then o.commune_id = cid
    when o.department_id is not null then o.department_id = did
    when o.region_id is not null then o.region_id = rid
    else false
  end
$$;

create or replace function my_officials()
returns setof officials
language sql stable security definer set search_path = politique, extensions, public as $$
  select o.* from officials o, private_profiles pp
  where pp.user_id = auth.uid()
    and not o.vacant
    and (o.mandate in ('president', 'vice_president', 'premier_ministre')
         or official_covers(o, pp.vote_commune_id, pp.vote_department_id, pp.vote_region_id))
  order by case o.mandate
    when 'maire' then 1 when 'depute' then 2 when 'president_conseil_regional' then 3
    when 'gouverneur_district' then 4 when 'senateur' then 5 when 'prefet' then 6
    when 'sous_prefet' then 7 when 'president' then 8 when 'vice_president' then 9
    when 'premier_ministre' then 10 else 11 end, o.rank, o.full_name
$$;

create or replace function official_constituents_count(oid uuid)
returns integer
language plpgsql stable security definer set search_path = politique, extensions, public as $$
declare o officials%rowtype; n int;
begin
  select * into o from officials where id = oid;
  if not found then return null; end if;
  select count(*) into n from private_profiles pp
  where official_covers(o, pp.vote_commune_id, pp.vote_department_id, pp.vote_region_id);
  if n < 50 then return null; end if;
  return (n / 10) * 10;
end $$;

create or replace function interpellation_constituent_share(iid uuid)
returns numeric
language plpgsql stable security definer set search_path = politique, extensions, public as $$
declare o officials%rowtype; total int; inside int;
begin
  select o2.* into o from officials o2 join interpellations i on i.official_id = o2.id where i.id = iid;
  if not found then return null; end if;
  if not (o.profile_id = auth.uid() or o.personal_profile_id = auth.uid() or is_moderator()) then return null; end if;
  select count(*), count(*) filter (where official_covers(o, pp.vote_commune_id, pp.vote_department_id, pp.vote_region_id))
  into total, inside
  from interpellation_votes v join private_profiles pp on pp.user_id = v.user_id
  where v.interpellation_id = iid;
  if total < 20 then return null; end if;
  return round(100.0 * inside / total / 5) * 5;   -- nearest 5 %
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
