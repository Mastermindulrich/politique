// Security checks for 0012_security.sql: every migration is applied to an in-process
// Postgres (PGlite), then members try, as the browser could, to do what they must not.
// Run: node tests/security.test.mjs
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { readFileSync } from "node:fs";

const db = new PGlite({ extensions: { citext, pg_trgm, unaccent } });
const sql = (s, p) => db.query(s, p);
const file = (f) => readFileSync(new URL(`../supabase/${f}`, import.meta.url), "utf8");

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
for (const m of ["0001_schema", "0002_auth_email_log", "0003_control_center", "0004_notifications", "0005_owner_badge",
  "0006_dm_attachments", "0007_social_features", "0008_speed", "0009_office_mandates", "0010_office_accounts", "0011_commune_showcases"]) {
  await db.exec(file(`migrations/${m}.sql`));
}
await db.exec(file("seed/ci_geo.sql"));
await db.exec(`set search_path = politique, public;
  grant usage on schema auth, storage to anon, authenticated;
  grant execute on all functions in schema auth to anon, authenticated;`);

let passed = 0;
const assert = (c, m) => { if (!c) throw new Error("ASSERT: " + m); passed++; };
const as = async (uid, fn) => {
  // Like PostgREST: the role, and the JWT claims the database's own checks read.
  await db.exec(`set role authenticated; select set_config('app.uid', '${uid ?? ""}', false), set_config('request.jwt.claims', '{"role":"authenticated"}', false)`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('app.uid', '', false), set_config('request.jwt.claims', '', false)`); }
};
const fails = async (fn, m) => { let ok = false; try { await fn(); } catch (e) { ok = true; if (process.env.WHY) console.log(m, "→", e.message); } assert(ok, "should be refused: " + m); };
const one = async (s, p) => (await sql(s, p)).rows[0];

// Members join like the app does (join_politique as the signed-in person).
const join = async (email, meta) => {
  const id = (await one(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [email, meta ? { app: "politique", ...meta } : { name: "autre site" }])).id;
  await as(id, () => sql(`select join_politique()`));
  return id;
};
await sql(`insert into owner_claims values ('ulrich@x.ci')`);
const owner = await join("ulrich@x.ci", { handle: "ulrich", display_name: "Ulrich" });
const amie = await join("amie@x.ci", { handle: "akissi", display_name: "Akissi Kouamé Bédié", vote_region_id: "1", vote_department_id: "1" });

// --- Before 0012: the follow bug, reproduced -------------------------------------
await fails(() => as(amie, () => sql(`insert into follows (follower_id, followee_id) values ($1, $2)`, [amie, owner])), "(before the fix) following the owner");

await db.exec(file("migrations/0012_security.sql"));
await db.exec(file("migrations/0012_security.sql")); // safe to run twice

// --- 1. Follow ---------------------------------------------------------------------
await as(amie, () => sql(`insert into follows (follower_id, followee_id) values ($1, $2)`, [amie, owner]));
assert((await one(`select followers_count n from profiles where id = $1`, [owner])).n === 1, "the owner can be followed");
await as(amie, () => sql(`delete from follows where follower_id = $1 and followee_id = $2`, [amie, owner]));
assert((await one(`select followers_count n from profiles where id = $1`, [owner])).n === 0, "and unfollowed");
await as(amie, () => sql(`insert into follows (follower_id, followee_id) values ($1, $2)`, [amie, owner]));
await as(amie, () => sql(`update profiles set display_name = 'Pirate' where id = $1`, [owner]));
assert((await one(`select display_name from profiles where id = $1`, [owner])).display_name === "Ulrich", "nobody renames the owner");

// --- 2. Name required ----------------------------------------------------------------
const sansNom = await join("koffi.yao.1990@x.ci", null); // an account from the other site
const r = await one(`select display_name, handle, needs_name from profiles where id = $1`, [sansNom]);
assert(r.needs_name === true && r.display_name === r.handle && !r.display_name.includes("koffi"), "no name: the handle stands in, the e-mail never shows, the name is asked " + JSON.stringify(r));
const bad = await join("bad@x.ci", { handle: "badname", display_name: "x@y.ci" });
assert((await one(`select needs_name from profiles where id = $1`, [bad])).needs_name === true, "an e-mail address is not a name");
const reserved = await join("res@x.ci", { handle: "admin_ci", display_name: "Awa" });
assert((await one(`select handle from profiles where id = $1`, [reserved])).handle !== "admin_ci", "staff-like handles are refused at sign-up");
for (const n of ["", " ", "1", "42 42", "a@b.ci", "https://spam.ci", "x"]) {
  await fails(() => as(sansNom, () => sql(`update profiles set display_name = $1 where id = $2`, [n, sansNom])), `name ${JSON.stringify(n)}`);
}
await as(sansNom, () => sql(`update profiles set display_name = '  Koffi   Yao ' where id = $1`, [sansNom]));
const fixed = await one(`select display_name, needs_name from profiles where id = $1`, [sansNom]);
assert(fixed.display_name === "Koffi Yao" && fixed.needs_name === false, "a real name clears the request " + JSON.stringify(fixed));
await fails(() => as(sansNom, () => sql(`update profiles set needs_name = false where id = $1`, [sansNom])), "clearing needs_name directly");
await fails(() => as(sansNom, () => sql(`update profiles set handle = 'moderateur' where id = $1`, [sansNom])), "taking a staff handle");
assert((await as(null, () => one(`select handle_available('politique_ci') ok`))).ok === false, "staff handles shown as taken");

// --- 3. Profile columns only the system writes -------------------------------------
for (const [col, val] of [["followers_count", 99999], ["verified", true], ["account_type", "'elu'"], ["is_admin", true], ["is_owner", true],
  ["posts_count", 5], ["verified_at", "now()"], ["suspended_until", "null"], ["deleted_at", "now()"]]) {
  await fails(() => as(amie, () => sql(`update profiles set ${col} = ${val} where id = $1`, [amie])), `a member setting ${col}`);
}
await as(amie, () => sql(`update profiles set bio = 'Bonjour', lang = 'en', theme = 'dark', onboarded_at = now() where id = $1`, [amie]));
assert((await one(`select bio from profiles where id = $1`, [amie])).bio === "Bonjour", "own bio, language and theme still editable");

// --- 4. Posts, polls and counters ------------------------------------------------------
const p = await as(amie, () => one(`insert into posts (author_id, text, like_count, view_count, reply_count, created_at, is_hidden)
  values ($1, 'Bonjour Abidjan', 5000, 90000, 40, now() - interval '3 days', false) returning *`, [amie]));
assert(p.like_count === 0 && p.view_count === 0 && p.reply_count === 0, "a new post starts with no fake likes or views");
assert(Date.now() - new Date(p.created_at).getTime() < 60_000, "a post cannot be back-dated (rate limits)");
await fails(() => as(amie, () => sql(`update posts set like_count = 1000 where id = $1`, [p.id])), "raising one's like count");
await sql(`update posts set is_hidden = true where id = $1`, [p.id]);
await fails(() => as(amie, () => sql(`update posts set is_hidden = false where id = $1`, [p.id])), "un-hiding a moderated post");
const poll = await as(amie, async () => {
  const pp = await one(`insert into posts (author_id, text) values ($1, 'Sondage ?') returning id`, [amie]);
  return one(`insert into polls (post_id, options, ends_at, counts, votes_count) values ($1, '["Oui","Non"]', now() + interval '1 year', '{900,1,0,0}', 901) returning *`, [pp.id]);
});
assert(poll.votes_count === 0 && poll.counts[0] === 0 && new Date(poll.ends_at) < new Date(Date.now() + 8 * 864e5), "polls start empty, seven days at most");

// --- 5. Conversations --------------------------------------------------------------
const third = await join("tiers@x.ci", { handle: "tiers", display_name: "Tiers Personne" });
const privateConv = await as(owner, () => one(`select get_or_create_dm($1) id`, [third]));
const myConv = await as(amie, () => one(`select get_or_create_dm($1) id`, [third]));
await fails(() => as(amie, () => sql(`update conversation_members set conversation_id = $1 where user_id = $2 and conversation_id = $3`, [privateConv.id, amie, myConv.id])), "joining someone else's conversation");
assert((await as(amie, () => one(`select count(*)::int n from messages where conversation_id = $1`, [privateConv.id]))).n === 0, "still outside");
const msg = await as(amie, () => one(`insert into messages (conversation_id, sender_id, text) values ($1, $2, 'salut') returning id`, [myConv.id, amie]));
await fails(() => as(amie, () => sql(`update messages set conversation_id = $1 where id = $2`, [privateConv.id, msg.id])), "moving a message into another conversation");
await fails(() => as(amie, () => sql(`insert into conversation_members (conversation_id, user_id) values ($1, $2)`, [myConv.id, owner])), "adding someone to a conversation by hand");
await as(amie, () => sql(`update conversation_members set last_read_at = now(), muted = true where conversation_id = $1 and user_id = $2`, [myConv.id, amie]));
await fails(() => as(amie, () => sql(`update notifications set user_id = $1`, [owner])), "moving notifications");

// --- 6. Official accounts, directory, Découvertes ----------------------------------------
const bonoua = (await one(`select id from ci_communes where name = 'Bonoua'`)).id;
const deputy = await join("dep@x.ci", { handle: "depute1", display_name: "Député Un" });
const mod = await join("mod@x.ci", { handle: "modo1", display_name: "Modo Un" });
await sql(`update profiles set is_moderator = true where id = $1`, [mod]);
const dep = await one(`insert into officials (full_name, mandate, profile_id) values ('Député Un', 'depute', $1) returning id`, [deputy]);
const mayor = await one(`insert into officials (full_name, mandate, commune_id) values ('Maire de Bonoua', 'maire', $1) returning id`, [bonoua]);
await as(deputy, () => sql(`update officials set mandate = 'maire', commune_id = $1 where id = $2`, [bonoua, dep.id]));
assert((await one(`select mandate from officials where id = $1`, [dep.id])).mandate === "depute", "an official cannot rewrite their directory row");
await as(amie, () => sql(`update officials set profile_id = $1 where id = $2`, [amie, mayor.id]));
assert((await one(`select profile_id from officials where id = $1`, [mayor.id])).profile_id === null, "a member cannot claim an office");
await as(mod, () => sql(`update officials set profile_id = $1 where id = $2`, [mod, mayor.id]));
assert((await one(`select profile_id from officials where id = $1`, [mayor.id])).profile_id === null, "a moderator cannot hand out office accounts");
for (const who of [amie, deputy, mod]) {
  await fails(() => as(who, () => sql(`insert into commune_showcases (commune_id, tagline, updated_by) values ($1, 'piraté', $2)`, [bonoua, who])), "editing a commune page without being its mayor");
}
await fails(() => as(amie, () => sql(`insert into verification_requests (user_id, requested_type, full_name, official_id, status) values ($1, 'elu', 'Akissi', $2, 'approved')`, [amie, mayor.id])), "a request that arrives approved");
await fails(() => as(amie, () => sql(`insert into verification_requests (user_id, requested_type, full_name, document_path) values ($1, 'elu', 'Akissi', $2)`, [amie, `${third}/piece.pdf`])), "someone else's document");
const req = await as(amie, () => one(`insert into verification_requests (user_id, requested_type, full_name, official_id) values ($1, 'elu', 'Akissi', $2) returning id`, [amie, mayor.id]));
await fails(() => as(mod, () => sql(`select review_verification($1, true)`, [req.id])), "a moderator approving an office account");
await fails(() => as(amie, () => sql(`update verification_requests set status = 'approved' where id = $1`, [req.id])).then(async () => {
  if ((await one(`select status from verification_requests where id = $1`, [req.id])).status !== "approved") throw new Error("unchanged");
}), "approving one's own request");
await as(owner, () => sql(`select review_verification($1, true)`, [req.id]));
assert((await one(`select profile_id from officials where id = $1`, [mayor.id])).profile_id === amie, "the owner links the office");
await as(amie, () => sql(`insert into commune_showcases (commune_id, tagline, updated_by) values ($1, 'Bienvenue', $2)`, [bonoua, amie]));
await as(amie, () => sql(`insert into commune_showcases (commune_id, tagline, updated_by) values ($1, 'Bonoua, ville verte', $2)
  on conflict (commune_id) do update set tagline = excluded.tagline, updated_by = excluded.updated_by`, [bonoua, amie]));
assert((await one(`select tagline from commune_showcases where commune_id = $1`, [bonoua])).tagline === "Bonoua, ville verte", "the recognised mayor edits their commune page");
const grandBassam = (await one(`select id from ci_communes where name = 'Grand-Bassam'`)).id;
await fails(() => as(amie, () => sql(`insert into commune_showcases (commune_id, tagline, updated_by) values ($1, 'x', $2)`, [grandBassam, amie])), "a mayor editing another commune");

// --- 7. Civic tools ----------------------------------------------------------------------
const it = await as(third, async () => {
  const post = await one(`insert into posts (author_id, text) values ($1, 'Question au maire') returning id`, [third]);
  return one(`insert into interpellations (author_id, official_id, post_id, title, upvotes_count, status) values ($1, $2, $3, 'Quand la route ?', 5000, 'repondue') returning *`, [third, mayor.id, post.id]);
});
assert(it.upvotes_count === 0 && it.status === "ouverte", "an interpellation starts open with no votes");
await fails(() => as(third, () => sql(`update interpellations set upvotes_count = 999 where id = $1`, [it.id])), "raising votes");
await fails(() => as(third, () => sql(`update interpellations set status = 'repondue' where id = $1`, [it.id])), "the author marking it answered");
await as(third, () => sql(`update interpellations set status = 'classee' where id = $1`, [it.id]));
assert((await one(`select status from interpellations where id = $1`, [it.id])).status === "classee", "the author can close their own");
const idea = await as(third, () => one(`insert into propositions (author_id, commune_id, title, body, votes_count, status) values ($1, $2, 'Un marché couvert', 'Pour Bonoua', 800, 'adoptee') returning *`, [third, bonoua]));
assert(idea.votes_count === 0 && idea.status === "nouvelle", "an idea starts new with no votes");
await as(third, () => sql(`update propositions set status = 'adoptee' where id = $1`, [idea.id]));
assert((await one(`select status from propositions where id = $1`, [idea.id])).status === "nouvelle", "the author cannot adopt their own idea");
await as(amie, () => sql(`update propositions set status = 'etudiee' where id = $1`, [idea.id]));
assert((await one(`select status from propositions where id = $1`, [idea.id])).status === "etudiee", "the commune's mayor answers it");
const prom = await as(third, () => one(`insert into promises (official_id, title, status, verified_by, created_by) values ($1, 'Goudronner la route', 'tenue', $2, $3) returning *`, [mayor.id, owner, third]));
assert(prom.status === "annoncee" && prom.verified_by === null, "a promise starts announced and unchecked");
await fails(() => as(amie, () => sql(`update promises set verified_by = $1 where id = $2`, [owner, prom.id])), "checking a promise in someone else's name");
await fails(() => as(amie, () => sql(`update promises set official_id = $1 where id = $2`, [dep.id, prom.id])), "moving a promise to another official");
await fails(() => as(third, () => sql(`insert into reports (reporter_id, profile_id, reason, status) values ($1, $2, 'spam', 'actioned')`, [third, amie])), "a report sent already handled");

// --- 8. Search -----------------------------------------------------------------------------
const find = async (q) => (await as(null, () => sql(`select handle from search_profiles($1, 10)`, [q]))).rows.map((x) => x.handle);
for (const q of ["akissi", "@akissi", "AKISSI", "Kouame", "kouamé", "bedie akissi", "Akissi B", "aki", "akisi"]) {
  assert((await find(q)).includes("akissi"), `search ${JSON.stringify(q)} finds Akissi Kouamé Bédié: ${JSON.stringify(await find(q))}`);
}
assert((await find("Ulrich"))[0] === "ulrich", "search by name finds the owner first");
assert((await find("zzzzqq")).length === 0, "no false hits");
assert((await find("%")).length === 0 && (await find("  ")).length === 0, "empty or wildcard searches return nothing");

console.log(`security OK: ${passed} checks passed`);
await db.close();
