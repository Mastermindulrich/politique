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
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, phone text, raw_user_meta_data jsonb);
  create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
  create or replace function storage.foldername(name text) returns text[] language sql as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
  create publication supabase_realtime;
`);

let schema = readFileSync(new URL("../supabase/migrations/0001_schema.sql", import.meta.url), "utf8");
await db.exec(schema);
await db.exec(readFileSync(new URL("../supabase/seed/ci_geo.sql", import.meta.url), "utf8"));

// --- Smoke tests ---------------------------------------------------------------
const as = (uid) => db.exec(`select set_config('app.uid', '${uid ?? ""}', false)`);
const u = async (handle, meta = {}) => {
  const r = await sql(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [`${handle}@x.ci`, { handle, display_name: handle, ...meta }]);
  return r.rows[0].id;
};
const assert = (c, m) => { if (!c) throw new Error("ASSERT: " + m); };

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

console.log("schema OK: all smoke checks passed");
await db.close();
