-- The platform's own editorial account, @politique ("La rédaction POLITIQUE").
-- It is an institution account, not a person: it publishes the documented
-- challenges and projects of each territory (supabase/seed/civic.sql), each with
-- its public source, and the monthly barometer question.
-- The owner signs in to it with a login code sent to the e-mail below.
-- Safe to re-run.
set search_path = politique, extensions, public;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', '5f0b1e3c-7a52-4c1e-9d0a-70011c0e0001', 'authenticated', 'authenticated',
  'redaction@prototypex.org', '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{"app":"politique","handle":"politique"}'::jsonb, now(), now(), '', '', '', ''
where not exists (select 1 from auth.users where email = 'redaction@prototypex.org');

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', null, now(), now()
from auth.users u
where u.email = 'redaction@prototypex.org'
  and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');

insert into profiles (id, handle, display_name, bio, website, avatar_url, account_type, verified, verified_at, onboarded_at)
select u.id, 'politique', 'La rédaction POLITIQUE',
  'Compte officiel de la plateforme. Nous documentons les défis et les projets de chaque territoire, sources à l''appui. Élus : répondez depuis votre compte de fonction.',
  'https://politique.prototypex.org', 'https://politique.prototypex.org/icons/icon-512.png', 'institution', true, now(), now()
from auth.users u
where u.email = 'redaction@prototypex.org'
on conflict do nothing;

-- Its private row stays empty: an institution does not vote anywhere.
insert into private_profiles (user_id)
select p.id from profiles p where p.handle = 'politique'
on conflict do nothing;

-- The barometer of the month, so the page is open from day one (an admin can still
-- publish the next ones from the control center).
insert into barometers (month, question, options, opens_at, closes_at, created_by)
select date '2026-11-01',
  'Quelle devrait être la priorité numéro un de votre commune en 2027 ?',
  '["Routes et voirie", "Eau potable", "Assainissement et inondations", "Santé", "Écoles", "Emploi des jeunes"]'::jsonb,
  now(), timestamptz '2026-12-01 00:00+00', p.id
from profiles p where p.handle = 'politique'
on conflict (month) do nothing;
