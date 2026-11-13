-- Rate limit for the login codes POLITIQUE emails itself (see lib/auth-email.ts).
-- Stores a SHA-256 of the address, never the address. Only the service role can use it.
set search_path = politique, extensions, public;

create table if not exists politique.auth_email_log (
  id bigint generated always as identity primary key,
  email_hash text not null,
  sent_at timestamptz not null default now()
);
create index if not exists auth_email_log_hash_time on politique.auth_email_log (email_hash, sent_at desc);
alter table politique.auth_email_log enable row level security;
revoke all on politique.auth_email_log from anon, authenticated;

-- Returns false when the address got a code in the last minute or five in the last hour;
-- otherwise records this send and returns true.
create or replace function politique.auth_email_allowed(h text) returns boolean
language plpgsql security definer set search_path = politique, public as $$
begin
  delete from politique.auth_email_log where sent_at < now() - interval '1 day';
  if exists (select 1 from politique.auth_email_log where email_hash = h and sent_at > now() - interval '60 seconds')
     or (select count(*) from politique.auth_email_log where email_hash = h and sent_at > now() - interval '1 hour') >= 5 then
    return false;
  end if;
  insert into politique.auth_email_log (email_hash) values (h);
  return true;
end $$;
revoke execute on function politique.auth_email_allowed(text) from public, anon, authenticated;
grant execute on function politique.auth_email_allowed(text) to service_role;
