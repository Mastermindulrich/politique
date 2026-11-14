// Applies the schema + geo seed to an in-process Postgres (PGlite) with stubs for
// the Supabase-provided auth/storage objects, then runs smoke checks.
// Run: node tests/schema.test.mjs
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { readFileSync } from "node:fs";

const db = new PGlite({ extensions: { citext, pg_trgm, unaccent } });
const sql = (s, p) => db.query(s, p);

// --- Supabase stubs -----------------------------------------------------------
await db.exec(`
  create schema auth; create schema storage;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, phone text, raw_user_meta_data jsonb, last_sign_in_at timestamptz);
  create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
  create or replace function storage.foldername(name text) returns text[] language sql as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
  create publication supabase_realtime;
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
`);

let schema = readFileSync(new URL("../supabase/migrations/0001_schema.sql", import.meta.url), "utf8");
await db.exec(schema);
await db.exec(readFileSync(new URL("../supabase/migrations/0002_auth_email_log.sql", import.meta.url), "utf8"));
await db.exec(readFileSync(new URL("../supabase/migrations/0003_control_center.sql", import.meta.url), "utf8"));
await db.exec(readFileSync(new URL("../supabase/migrations/0004_notifications.sql", import.meta.url), "utf8"));
await db.exec(readFileSync(new URL("../supabase/migrations/0005_owner_badge.sql", import.meta.url), "utf8"));
await db.exec(readFileSync(new URL("../supabase/migrations/0006_dm_attachments.sql", import.meta.url), "utf8"));
await db.exec(readFileSync(new URL("../supabase/seed/ci_geo.sql", import.meta.url), "utf8"));
await db.exec(`set search_path = politique, public`);

// --- Smoke tests ---------------------------------------------------------------
const as = (uid) => db.exec(`select set_config('app.uid', '${uid ?? ""}', false)`);
const assert = (c, m) => { if (!c) throw new Error("ASSERT: " + m); };
const u = async (handle, meta = {}) => {
  const r = await sql(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [`${handle}@x.ci`, { app: "politique", handle, display_name: handle, ...meta }]);
  const id = r.rows[0].id;
  await as(id);
  assert((await sql(`select join_politique() j`)).rows[0].j === true, "join_politique creates the profile");
  assert((await sql(`select join_politique() j`)).rows[0].j === false, "join_politique is a no-op the second time");
  await as(null);
  return id;
};

// A user of the other app sharing the project gets nothing until they join.
const other = (await sql(`insert into auth.users (email, raw_user_meta_data) values ('site@x.ci', '{"name":"Site"}') returning id`)).rows[0].id;
assert((await sql(`select count(*)::int n from profiles`)).rows[0].n === 0, "no profile for a non-POLITIQUE auth user");

const cocody = (await sql(`select id from ci_communes where name='Cocody'`)).rows[0].id;
const yop = (await sql(`select id from ci_communes where name='Yopougon'`)).rows[0].id;
const awa = await u("awakone", { vote_region_id: 1, vote_department_id: 1, vote_commune_id: cocody });
const yao = await u("yaok", { vote_region_id: 1, vote_department_id: 1, vote_commune_id: yop });
const kof = await u("kofi", { vote_region_id: 1, vote_department_id: 1, vote_commune_id: cocody });
assert((await sql(`select count(*)::int n from profiles`)).rows[0].n === 3, "profiles created by trigger");
assert((await sql(`select vote_commune_id from private_profiles where user_id=$1`, [awa])).rows[0].vote_commune_id === cocody, "private profile stored");

// Official: Awa is député de Cocody
await sql(`update profiles set verified=true, account_type='elu' where id=$1`, [awa]);
await sql(`insert into officials (profile_id, full_name, mandate, title, region_id, department_id, commune_id) values ($1,'Awa Koné','depute','Députée de Cocody',1,1,$2)`, [awa, cocody]);

await as(kof);
const mine = (await sql(`select full_name from my_officials()`)).rows;
assert(mine.length === 1 && mine[0].full_name === "Awa Koné", "my_officials matches commune: " + JSON.stringify(mine));
await as(yao);
assert((await sql(`select count(*)::int n from my_officials()`)).rows[0].n === 0, "yao in Yopougon has no official yet");

// Post with hashtag + mention, reply, like, repost, poll
await as(awa);
const post = (await sql(`insert into posts (author_id, text) values ($1, 'Budget #Routes2027 voté. Merci @kofi !') returning id, hashtags, mentions`, [awa])).rows[0];
assert(post.hashtags[0] === "routes2027", "hashtag parsed: " + post.hashtags);
assert(post.mentions.length === 1, "mention parsed");
await sql(`insert into polls (post_id, options, ends_at) values ($1, '["Routes","Écoles"]', now() + interval '1 day')`, [post.id]);
await as(kof);
await sql(`insert into posts (author_id, kind, parent_id, text) values ($1,'reply',$2,'Bravo')`, [kof, post.id]);
await sql(`insert into likes (user_id, post_id) values ($1,$2)`, [kof, post.id]);
await sql(`insert into reposts (user_id, post_id) values ($1,$2)`, [kof, post.id]);
await sql(`insert into poll_votes (post_id, user_id, option_idx) values ($1,$2,0)`, [post.id, kof]);
const p = (await sql(`select reply_count, like_count, repost_count from posts where id=$1`, [post.id])).rows[0];
assert(p.reply_count === 1 && p.like_count === 1 && p.repost_count === 1, "counters " + JSON.stringify(p));
assert((await sql(`select counts, votes_count from polls where post_id=$1`, [post.id])).rows[0].counts[0] === 1, "poll counted");
// kofi (Cocody voter) got the official_post notification, yao (Yopougon) did not
const n = (await sql(`select user_id, type from notifications where type='official_post'`)).rows;
assert(n.length === 1 && n[0].user_id === kof, "official_post fan-out: " + JSON.stringify(n));
// awa got like/reply/repost/mention? mention was kofi; awa gets like, reply, repost
const an = (await sql(`select type from notifications where user_id=$1 order by type`, [awa])).rows.map((r) => r.type);
assert(an.join() === "like,reply,repost", "awa notifications " + an);

// Feed
const feed = (await sql(`select * from feed_for_you(10)`)).rows;
assert(feed.length === 1 && feed[0].reason === "votre_elu", "feed reason " + JSON.stringify(feed));
assert((await sql(`select * from trending_hashtags()`)).rows[0].tag === "routes2027", "trending");
assert((await sql(`select count(*)::int n from search_posts('budget')`)).rows[0].n === 1, "search");

// Interpellation + constituent share (null under 20 voters)
const off = (await sql(`select id from officials`)).rows[0].id;
const ip = (await sql(`insert into interpellations (author_id, official_id, title) values ($1,$2,'Quand les routes de la Riviera ?') returning id`, [kof, off])).rows[0];
await sql(`insert into interpellation_votes (interpellation_id, user_id) values ($1,$2)`, [ip.id, kof]);
assert((await sql(`select upvotes_count from interpellations where id=$1`, [ip.id])).rows[0].upvotes_count === 1, "interp votes");
assert((await sql(`select interpellation_constituent_share($1) s`, [ip.id])).rows[0].s === null, "share hidden under threshold");
await as(awa);
await sql(`update interpellations set status='repondue' where id=$1`, [ip.id]);
assert((await sql(`select count(*)::int n from notifications where type='interpellation_answer' and user_id=$1`, [kof])).rows[0].n === 1, "answer notif");

// DM
await as(kof);
const cid = (await sql(`select get_or_create_dm($1) id`, [awa])).rows[0].id;
assert((await sql(`select get_or_create_dm($1) id`, [awa])).rows[0].id === cid, "dm reused");
await sql(`insert into messages (conversation_id, sender_id, text) values ($1,$2,'Bonjour')`, [cid, kof]);
await as(awa);
const uc = (await sql(`select * from unread_counts()`)).rows[0];
assert(Number(uc.messages) === 1, "unread messages " + JSON.stringify(uc));

// Barometer (threshold)
const b = (await sql(`insert into barometers (month, question, options, closes_at) values ('2026-11-01','Priorité ?','["Routes","Écoles"]', now()+interval '10 days') returning id`)).rows[0];
await sql(`insert into barometer_votes (barometer_id, user_id, option_idx) values ($1,$2,0),($1,$3,1)`, [b.id, kof, yao]);
const br = (await sql(`select * from barometer_results($1)`, [b.id])).rows;
assert(br.length === 1 && br[0].commune_id === null && br[0].votes === 2, "barometer national only " + JSON.stringify(br));

// --- RLS as a real non-superuser role -------------------------------------------
// Table and function privileges come from the migration itself; only the stub schemas need grants here.
await db.exec(`
  grant usage on schema auth, storage to anon, authenticated;
  grant execute on all functions in schema auth to anon, authenticated;
`);
const asRole = async (uid, fn, role = "authenticated") => {
  await db.exec(`set role ${role}; select set_config('app.uid', '${uid ?? ""}', false)`);
  try { return await fn(); } finally { await db.exec(`reset role`); }
};
const fails = async (fn, m) => { let ok = false; try { await fn(); } catch { ok = true; } assert(ok, "should be refused: " + m); };

// A signed-out visitor reads the public square and nothing private.
await asRole(null, async () => {
  assert((await sql(`select count(*)::int n from profiles`)).rows[0].n === 3, "anon reads profiles");
  assert((await sql(`select count(*)::int n from posts`)).rows[0].n >= 1, "anon reads posts");
  assert((await sql(`select count(*)::int n from officials`)).rows[0].n === 1, "anon reads the directory");
  assert((await sql(`select handle_available('libre_456') a`)).rows[0].a === true, "anon checks a handle at sign-up");
  await fails(() => sql(`select * from private_profiles`), "anon reading voting places");
  await fails(() => sql(`select * from messages`), "anon reading messages");
  await fails(() => sql(`select * from barometer_votes`), "anon reading barometer votes");
  await fails(() => sql(`insert into posts (author_id, text) values ($1, 'x')`, [kof]), "anon posting");
  assert((await sql(`select count(*)::int n from my_officials()`)).rows[0].n === 0, "anon has no officials");
}, "anon");

// The voting place is private: yao cannot read kofi's, kofi reads only his own.
await asRole(yao, async () => {
  const r = (await sql(`select user_id from private_profiles`)).rows;
  assert(r.length === 1 && r[0].user_id === yao, "private_profiles: own row only, got " + r.length);
  const upd = await sql(`update private_profiles set vote_commune_id = 1 where user_id = $1`, [kof]);
  assert(upd.affectedRows === 0, "cannot update someone else's voting place");
  // public tables still readable
  assert((await sql(`select count(*)::int n from profiles`)).rows[0].n === 3, "profiles public");
  assert((await sql(`select count(*)::int n from posts`)).rows[0].n >= 2, "posts public");
  // cannot self-verify or self-promote
  await fails(() => sql(`update profiles set verified = true where id = $1`, [yao]), "self-verify");
  await fails(() => sql(`update profiles set is_admin = true where id = $1`, [yao]), "self-admin");
  await sql(`update profiles set bio = 'Yop city' where id = $1`, [yao]);
  // cannot post as someone else, can post as self, reply, like
  await fails(() => sql(`insert into posts (author_id, text) values ($1, 'x')`, [kof]), "post as other");
  const mine = (await sql(`insert into posts (author_id, text) values ($1, 'Bonjour #Yopougon') returning id`, [yao])).rows[0].id;
  await sql(`insert into posts (author_id, kind, parent_id, text) values ($1, 'reply', $2, 'réponse')`, [yao, post.id]);
  await sql(`insert into likes (user_id, post_id) values ($1, $2)`, [yao, post.id]);
  await sql(`insert into follows (follower_id, followee_id) values ($1, $2)`, [yao, awa]);
  // not a member of kofi/awa's conversation
  assert((await sql(`select count(*)::int n from messages`)).rows[0].n === 0, "messages hidden from non-members");
  assert((await sql(`select count(*)::int n from conversations`)).rows[0].n === 0, "conversations hidden");
  await fails(() => sql(`insert into messages (conversation_id, sender_id, text) values ($1, $2, 'intrus')`, [cid, yao]), "message into foreign conversation");
  // others' notifications hidden; interpellation upvoters hidden
  assert((await sql(`select count(*)::int n from notifications where user_id <> $1`, [yao])).rows[0].n === 0, "notifications own only");
  assert((await sql(`select count(*)::int n from interpellation_votes`)).rows[0].n === 0, "interpellation voters hidden");
  // moderation is closed to citizens
  await fails(() => sql(`select mod_suspend($1, now() + interval '1 day')`, [kof]), "mod_suspend");
  await fails(() => sql(`insert into post_labels (post_id, label, labeled_by) values ($1, 'fausse', $2)`, [post.id, yao]), "label post");
  const hid = await sql(`update posts set is_hidden = true where id = $1`, [post.id]);
  assert(hid.affectedRows === 0, "cannot hide someone's post");
  // can start a DM, report, vote on an interpellation, propose an idea
  const c2 = (await sql(`select get_or_create_dm($1) id`, [awa])).rows[0].id;
  await sql(`insert into messages (conversation_id, sender_id, text) values ($1, $2, 'Bonjour Madame la députée')`, [c2, yao]);
  assert((await sql(`select count(*)::int n from messages`)).rows[0].n === 1, "own messages visible");
  await sql(`insert into reports (reporter_id, post_id, reason) values ($1, $2, 'spam')`, [yao, post.id]);
  await sql(`insert into interpellation_votes (interpellation_id, user_id) values ($1, $2)`, [ip.id, yao]);
  await sql(`insert into propositions (author_id, commune_id, title, body) values ($1, $2, 'Un marché couvert', 'Près de la gare')`, [yao, yop]);
  assert((await sql(`select interpellation_constituent_share($1) s`, [ip.id])).rows[0].s === null, "share only for the official");
  assert((await sql(`select handle_available('yaok') a, handle_available('libre_123') b`)).rows[0].b === true, "handle_available");
  assert((await sql(`select * from feed_for_you(10, now(), 0)`)).rows.length >= 2, "feed as role");
});
// The official answers and sees only aggregates.
await asRole(awa, async () => {
  assert((await sql(`select count(*)::int n from private_profiles`)).rows[0].n === 1, "official sees only own private row");
  assert((await sql(`select official_constituents_count($1) n`, [off])).rows[0].n === null, "constituent count hidden under 50");
});
// Moderator powers.
await sql(`update profiles set is_moderator = true where id = $1`, [kof]);
await asRole(kof, async () => {
  assert((await sql(`select count(*)::int n from reports`)).rows[0].n === 1, "moderator sees reports");
  await sql(`select mod_suspend($1, now() + interval '7 days', 'test')`, [yao]);
  await sql(`insert into post_labels (post_id, label, labeled_by) values ($1, 'contexte', $2)`, [post.id, kof]);
  assert((await sql(`select count(*)::int n from private_profiles`)).rows[0].n === 1, "moderators cannot read voting places either");
});
await asRole(yao, async () => {
  await fails(() => sql(`insert into posts (author_id, text) values ($1, 'suspendu')`, [yao]), "suspended user posting");
});

// The other app's user joins POLITIQUE later, passing the sign-up form.
await as(other);
assert((await sql(`select join_politique($1) j`, [{ handle: "awakone", display_name: "Site", vote_region_id: "1", vote_department_id: "1" }])).rows[0].j === true, "existing auth user can join");
const joined = (await sql(`select p.handle, pp.vote_region_id from profiles p join private_profiles pp on pp.user_id = p.id where p.id = $1`, [other])).rows[0];
assert(joined.handle !== "awakone" && joined.vote_region_id === 1, "taken handle replaced, voting place kept: " + JSON.stringify(joined));
await as(null);

// Owner control center.
await sql(`insert into owner_claims (email) values ('boss@x.ci')`);
const boss = await u("boss");
assert((await sql(`select is_owner from profiles where id = $1`, [boss])).rows[0].is_owner === true, "claimed e-mail becomes owner");
assert((await sql(`select is_owner from profiles where id = $1`, [yao])).rows[0].is_owner === false, "others are not owner");
await asRole(yao, async () => {
  await fails(() => sql(`update profiles set is_admin = true where id = $1`, [yao]), "self-promotion to admin");
  await fails(() => sql(`select owner_set_setting('posting', 'false')`), "non-owner changing a setting");
  await fails(() => sql(`select admin_stats()`), "member reading admin stats");
});
await asRole(boss, async () => {
  await sql(`select owner_set_role($1, 'admin')`, [kof]);
  await sql(`select owner_set_setting('posting', 'false')`);
  const m = (await sql(`select * from admin_members(null, 'staff')`)).rows;
  assert(m.length === 2 && m.every((r) => r.email), "owner lists staff with e-mails");
  assert((await sql(`select (admin_stats()->>'members')::int n`)).rows[0].n >= 4, "owner reads stats");
  await sql(`insert into posts (author_id, text) values ($1, 'le patron teste')`, [boss]);
});
await asRole(awa, async () => {
  await fails(() => sql(`insert into posts (author_id, text) values ($1, 'coupé')`, [awa]), "posting while posting is switched off");
});
await asRole(null, async () => {
  await fails(() => sql(`select detach_member($1, $2)`, [awa, kof]), "visitor detaching a member's records");
}, "anon");
await asRole(kof, async () => {
  await fails(() => sql(`select detach_member($1, $2)`, [awa, kof]), "admin detaching a member's records");
  assert((await sql(`select email from admin_members() limit 1`)).rows[0].email === null, "admins do not see e-mails");
  await fails(() => sql(`select mod_suspend($1, now() + interval '1 day', 'x')`, [boss]), "admin suspending the owner");
  await fails(() => sql(`select owner_set_role($1, 'member')`, [awa]), "admin changing roles");
});
await asRole(boss, async () => {
  await sql(`select owner_set_setting('posting', 'true')`);
  await sql(`select owner_set_setting('signups_open', 'false')`);
});
const late = (await sql(`insert into auth.users (email) values ('late@x.ci') returning id`)).rows[0].id;
await as(late);
assert((await sql(`select join_politique() j`)).rows[0].j === false, "closed sign-ups block joining");
await as(null);
await asRole(boss, async () => {
  await sql(`select owner_set_setting('signups_open', 'true')`);
  await sql(`select owner_remove_member($1)`, [yao]);
  assert((await sql(`select count(*)::int n from admin_log`)).rows[0].n >= 5, "actions are logged");
});
assert((await sql(`select count(*)::int n from profiles where id = $1`, [yao])).rows[0].n === 0, "owner removed a member");

// --- Notifications: preferences, follows, mutes, push subscriptions -----------------
const na = await u("notifa"), nb = await u("notifb"), nc = await u("notifc");
await sql(`insert into follows (follower_id, followee_id) values ($1, $2)`, [nb, na]);
const pa = (await sql(`insert into posts (author_id, text) values ($1, 'Bonjour Abidjan') returning id`, [na])).rows[0].id;
assert((await sql(`select count(*)::int n from notifications where user_id=$1 and type='following_post' and post_id=$2`, [nb, pa])).rows[0].n === 1, "followers hear about a new post");
await sql(`insert into posts (author_id, text, parent_id, kind) values ($1, 'une réponse', $2, 'reply')`, [na, pa]);
assert((await sql(`select count(*)::int n from notifications where user_id=$1 and type='following_post'`, [nb])).rows[0].n === 1, "replies do not notify followers");
// nb turns likes off in the app: no row at all
await sql(`insert into notification_prefs (user_id, inapp) values ($1, '{"likes": false}')`, [nb]);
const pb = (await sql(`insert into posts (author_id, text) values ($1, 'post de b') returning id`, [nb])).rows[0].id;
await sql(`insert into likes (user_id, post_id) values ($1, $2)`, [na, pb]);
assert((await sql(`select count(*)::int n from notifications where user_id=$1 and type='like'`, [nb])).rows[0].n === 0, "likes switched off");
await sql(`insert into reposts (user_id, post_id) values ($1, $2)`, [na, pb]);
assert((await sql(`select count(*)::int n from notifications where user_id=$1 and type='repost'`, [nb])).rows[0].n === 1, "reposts still on");
// muted accounts do not notify; blocks neither
await sql(`insert into mutes (muter_id, muted_id) values ($1, $2)`, [nb, nc]);
await sql(`insert into posts (author_id, text) values ($1, 'salut @notifb')`, [nc]);
assert((await sql(`select count(*)::int n from notifications where user_id=$1 and type='mention'`, [nb])).rows[0].n === 0, "muted account's mention is dropped");
// push defaults: replies yes, likes no; quiet hours all day silence push but not the app
assert((await sql(`select notif_wanted($1, 'reply', true) w`, [na])).rows[0].w === true, "replies pushed by default");
assert((await sql(`select notif_wanted($1, 'like', true) w`, [na])).rows[0].w === false, "likes not pushed by default");
const hr = new Date().getUTCHours();
await sql(`insert into notification_prefs (user_id, quiet_start, quiet_end) values ($1, $2, $3)`, [na, hr, (hr + 1) % 24]);
assert((await sql(`select notif_wanted($1, 'reply', true) w`, [na])).rows[0].w === false, "quiet hours hold push");
assert((await sql(`select notif_wanted($1, 'reply', false) w`, [na])).rows[0].w === true, "quiet hours keep the app");
assert((await sql(`select notif_wanted($1, 'moderation', false) w`, [nb])).rows[0].w === true, "account notices always on");
// push subscriptions: saved through the function, visible to the owner only
await asRole(nb, async () => {
  await sql(`select save_push_subscription('https://push.example/abc', 'key', 'auth', 'test')`);
  assert((await sql(`select count(*)::int n from push_subscriptions`)).rows[0].n === 1, "owner sees own subscription");
  await fails(() => sql(`insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://x', 'k', 'a')`, [nb]), "direct insert");
  await fails(() => sql(`select save_push_subscription('http://insecure', 'k', 'a')`), "non-https endpoint");
  await fails(() => sql(`select notif_wanted($1, 'like', true)`, [na]), "reading someone's preferences");
});
await asRole(na, async () => {
  assert((await sql(`select count(*)::int n from push_subscriptions`)).rows[0].n === 0, "others' subscriptions hidden");
  assert((await sql(`select count(*)::int n from notification_prefs`)).rows[0].n === 1, "own preferences only");
  await sql(`select save_push_subscription('https://push.example/abc', 'key2', 'auth2')`);
});
assert((await sql(`select user_id from push_subscriptions where endpoint='https://push.example/abc'`)).rows[0].user_id === na, "a browser follows the last account that subscribed");
await asRole(null, async () => {
  await fails(() => sql(`select * from push_subscriptions`), "visitor reading subscriptions");
  await fails(() => sql(`select save_push_subscription('https://push.example/z', 'k', 'a')`), "visitor subscribing");
}, "anon");

// --- Founder badge: one owner, nobody can grant, fake or imitate it ----------------
await asRole(na, async () => {
  await fails(() => sql(`update profiles set is_owner = true where id = $1`, [na]), "member making themself owner");
  await fails(() => sql(`update profiles set display_name = 'Fondateur' where id = $1`, [na]), "member using 'Fondateur'");
  await fails(() => sql(`update profiles set display_name = 'The Owner' where id = $1`, [na]), "member using 'Owner'");
  await fails(() => sql(`update profiles set display_name = 'Roi 👑' where id = $1`, [na]), "member using a crown");
  await fails(() => sql(`update profiles set handle = 'founder_ci' where id = $1`, [na]), "member using a founder handle");
  await sql(`update profiles set display_name = 'Notif A' where id = $1`, [na]);
  assert((await sql(`select handle_available('vrai_fondateur') a`)).rows[0].a === false, "reserved handle reads as taken");
});
await asRole(boss, async () => {
  await fails(() => sql(`update profiles set is_owner = true where id = $1`, [nb]), "owner granting the badge to someone");
  await fails(() => sql(`update profiles set is_owner = false where id = $1`, [boss]), "owner dropping their own badge through the app");
  await sql(`update profiles set display_name = 'Boss · Fondateur 👑' where id = $1`, [boss]);
});
await fails(() => sql(`update profiles set is_owner = true where id = $1`, [nb]), "a second owner, even from the SQL editor");
await sql(`insert into owner_claims (email) values ('fakeboss@x.ci')`);
const fake = await u("fakeboss", { display_name: "Le Fondateur" });
const fk = (await sql(`select is_owner, display_name from profiles where id = $1`, [fake])).rows[0];
assert(fk.is_owner === false && fk.display_name === "fakeboss", "a second claimed e-mail cannot become owner, reserved name replaced: " + JSON.stringify(fk));
assert((await sql(`select count(*)::int n from profiles where is_owner`)).rows[0].n === 1, "exactly one owner");

// --- Attachments in direct messages ----------------------------------------------
const dmBucket = (await sql(`select public, allowed_mime_types from storage.buckets where id = 'politique-dm'`)).rows[0];
assert(dmBucket.public === false, "DM bucket is private");
assert(!dmBucket.allowed_mime_types.some((m) => m.startsWith("video/")), "no videos in the DM bucket");
const dmPath = (who, f = "a1.jpg") => `${cid}/${who}/${f}`;
await asRole(kof, async () => {
  assert((await sql(`select dm_object_allowed($1, 'write') ok`, [dmPath(kof)])).rows[0].ok === true, "member uploads into own folder");
  assert((await sql(`select dm_object_allowed($1, 'write') ok`, [dmPath(awa)])).rows[0].ok === false, "not into the other member's folder");
  assert((await sql(`select dm_object_allowed($1, 'read') ok`, [dmPath(awa)])).rows[0].ok === true, "member reads the other member's file");
  assert((await sql(`select dm_object_allowed('not-a-uuid/x/y.jpg', 'read') ok`)).rows[0].ok === false, "malformed path refused without error");
  assert((await sql(`select dm_object_allowed($1, 'read') ok`, [`${cid}/${kof}`])).rows[0].ok === false, "folder only refused");
  await sql(`insert into messages (conversation_id, sender_id, text, media) values ($1, $2, '', $3)`,
    [cid, kof, JSON.stringify([{ type: "image", path: dmPath(kof), name: "photo.jpg", size: 1200, mime: "image/jpeg" }, { type: "file", path: dmPath(kof, "b2.pdf"), name: "Programme.pdf" }])]);
  await fails(() => sql(`insert into messages (conversation_id, sender_id, media) values ($1, $2, $3)`, [cid, kof, JSON.stringify([{ type: "image", path: dmPath(awa) }])]), "attachment from someone else's folder");
  await fails(() => sql(`insert into messages (conversation_id, sender_id, media) values ($1, $2, $3)`, [cid, kof, JSON.stringify([{ type: "image", path: dmPath(kof), url: "https://evil.example/x.jpg" }])]), "attachment with an outside URL");
  await fails(() => sql(`insert into messages (conversation_id, sender_id, media) values ($1, $2, $3)`, [cid, kof, JSON.stringify([{ type: "script", path: dmPath(kof) }])]), "unknown attachment type");
  await fails(() => sql(`insert into messages (conversation_id, sender_id, media) values ($1, $2, $3)`, [cid, kof, JSON.stringify([{ type: "video", path: dmPath(kof, "v.mp4") }])]), "video attachment");
  await fails(() => sql(`insert into messages (conversation_id, sender_id, media) values ($1, $2, $3)`, [cid, kof, JSON.stringify([{ type: "image", path: `${cid}/${kof}/../x.jpg` }])]), "path escaping the folder");
});
await asRole(yao, async () => {
  assert((await sql(`select dm_object_allowed($1, 'read') ok`, [dmPath(kof)])).rows[0].ok === false, "outsider cannot read DM files");
  assert((await sql(`select dm_object_allowed($1, 'write') ok`, [`${cid}/${yao}/x.jpg`])).rows[0].ok === false, "outsider cannot upload into the conversation");
});
await asRole(null, async () => {
  await fails(() => sql(`select dm_object_allowed($1, 'read')`, [dmPath(kof)]), "visitor calling the storage check");
}, "anon");

console.log("schema OK: all smoke and RLS checks passed");
await db.close();
