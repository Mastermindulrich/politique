// Generates supabase/seed/civic.sql from data/civic/*.json.
// Usage: node scripts/gen-civic-sql.mjs   (npm run civic)
//
// The "dossiers du territoire": documented local challenges and announced
// projects, researched from public sources and attached to the office accounts
// (data/officials) through features that already exist:
//   - a challenge ("defi") becomes an open interpellation of the office, carried
//     by a public post like any interpellation, so it shows on the official's
//     page, in "Mes élus", in the commune feed and in the main feed;
//   - a project ("projet") becomes a tracked promise of the office, dated and
//     linked to its source, with the status the source reports.
// Everything is published by the platform's own editorial account (@politique,
// an "institution" account), never under a person's name, and every item cites
// its source. Ids are derived from the content key, and rows are inserted with
// ON CONFLICT DO NOTHING, so re-running never duplicates anything nor overwrites
// what an official later changed (an answer, a status, a closed question).
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, "../data/civic");
const officialsDir = path.join(here, "../data/officials");
export const EDITOR_HANDLE = "politique";

const offices = new Set();
const deputies = []; // { key, communes: [name] }
const mayorOf = new Map(); // commune name -> mayor office key
const officeTitle = new Map(); // office key -> "Maire d'Abobo"
for (const f of readdirSync(officialsDir).filter((f) => f.endsWith(".json"))) {
  for (const o of JSON.parse(readFileSync(path.join(officialsDir, f), "utf8")).offices) {
    offices.add(o.key);
    officeTitle.set(o.key, o.title);
    if (o.mandate === "depute" && o.communes?.length) deputies.push({ key: o.key, communes: o.communes });
    if (o.mandate === "maire") mayorOf.set(o.commune, o.key);
  }
}

const uuid = (s) => {
  const h = createHash("md5").update("politique-civic:" + s).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};
const q = (v) => (v === null || v === undefined ? "null" : "'" + String(v).replace(/'/g, "''") + "'");
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const frDate = (d) => {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  if (!m) return String(y);
  return day ? `${day === 1 ? "1er" : day} ${MONTHS[m - 1]} ${y}` : `${MONTHS[m - 1]} ${y}`;
};
const host = (u) => new URL(u).hostname.replace(/^www\./, "");
const sourceLine = (s) => `${s.name ?? host(s.url)}${s.date ? `, ${frDate(s.date)}` : ""} : ${s.url}`;
const STATUS = { annonce: "annoncee", annoncee: "annoncee", en_cours: "en_cours", realise: "tenue", tenue: "tenue", partiellement_realise: "partiellement_tenue", partiellement_tenue: "partiellement_tenue", non_tenue: "non_tenue" };
const day = (d) => (d && /^\d{4}(-\d{2}){0,2}$/.test(d) ? (d.length === 4 ? `${d}-01-01` : d.length === 7 ? `${d}-01` : d) : null);
// Tag for the feed: #Abobo, #SanPédro (letters and digits only, as the post trigger reads them).
const tag = (s) => s.split(/[^\p{L}\p{N}]+/u).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join("");

const errors = [];
const interps = [];
const promises = [];
const seen = new Set();
for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  const data = JSON.parse(readFileSync(path.join(dir, file), "utf8"));
  for (const it of data.items) {
    const where = `${file} ${it.office} "${it.title}"`;
    if (!offices.has(it.office)) { errors.push(`${where}: unknown office`); continue; }
    const sources = it.sources ?? (it.source ? [it.source] : []);
    if (!sources.length || sources.some((s) => !/^https?:\/\//.test(s.url ?? ""))) { errors.push(`${where}: needs a source url`); continue; }
    const key = `${it.kind}:${it.office}:${it.title}`;
    if (seen.has(key)) { errors.push(`${where}: duplicate`); continue; }
    seen.add(key);
    if (it.kind === "defi") {
      if (it.title.length < 5 || it.title.length > 140) { errors.push(`${where}: title must be 5-140 chars (${it.title.length})`); continue; }
      const src = `${sources.length > 1 ? "Sources" : "Source"} :\n${sources.map(sourceLine).join("\n")}`;
      const body = `${it.body.trim()}\n\n${src}`;
      if (body.length > 2000) { errors.push(`${where}: body too long (${body.length})`); continue; }
      const tags = ["#Interpellation", ...(it.tags ?? []).map((t) => "#" + tag(t))].join(" ");
      // Office accounts aren't claimed yet, so the post names the office it questions.
      const to = `Destinataire : ${officeTitle.get(it.office)}\n\n`;
      let text = `${to}${it.title}\n\n${it.body.trim()}\n\n${sourceLine(sources[0])}\n${tags}`;
      if (text.length > 1000) {
        const room = 1000 - (text.length - it.body.trim().length) - 1;
        text = `${to}${it.title}\n\n${it.body.trim().slice(0, room).replace(/\s+\S*$/, "")}…\n\n${sourceLine(sources[0])}\n${tags}`;
      }
      if (text.length > 1000) { errors.push(`${where}: post too long`); continue; }
      interps.push({ id: uuid("i:" + key), post: uuid("p:" + key), office: it.office, title: it.title, body, text });
    } else if (it.kind === "projet") {
      if (it.title.length < 5 || it.title.length > 200) { errors.push(`${where}: title must be 5-200 chars`); continue; }
      const extra = sources.slice(1);
      const description = `${it.body.trim()}${extra.length ? `\n\n${extra.length > 1 ? "Autres sources" : "Autre source"} :\n${extra.map(sourceLine).join("\n")}` : ""}`;
      if (description.length > 2000) { errors.push(`${where}: description too long`); continue; }
      const status = STATUS[it.status ?? "annonce"];
      if (!status) { errors.push(`${where}: unknown status ${it.status}`); continue; }
      promises.push({ id: uuid("r:" + key), office: it.office, title: it.title, description, source_url: sources[0].url, made_at: day(it.made_at ?? sources[0].date), due_at: day(it.due_at), status, status_note: it.status_note ?? null });
    } else errors.push(`${where}: kind must be defi or projet`);
  }
}
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }

// A deputy's constituency shares its communes' challenges: each deputy whose constituency
// covers a documented commune is asked about one of them (round robin when several deputies
// share a commune), on their own page only. These carry no feed post, so the feed doesn't
// show the same question twice.
const byMayor = new Map();
for (const r of interps) { if (!byMayor.has(r.office)) byMayor.set(r.office, []); byMayor.get(r.office).push(r); }
const turn = new Map();
for (const d of deputies) {
  const picked = [];
  for (const c of d.communes) {
    const list = byMayor.get(mayorOf.get(c)) ?? [];
    if (!list.length) continue;
    const i = turn.get(c) ?? 0; turn.set(c, i + 1);
    picked.push({ c, r: list[i % list.length] });
  }
  for (const { c, r } of picked.slice(0, 2)) {
    const intro = `Ce défi touche ${c}, dans votre circonscription. Comment comptez-vous le porter à l'Assemblée nationale et auprès du Gouvernement ?\n\n`;
    const body = (intro + r.body).slice(0, 2000);
    interps.push({ id: uuid(`i:deputy:${d.key}:${r.id}`), post: null, office: d.key, title: r.title, body, text: null });
  }
}

const out = [];
out.push(`-- Generated by scripts/gen-civic-sql.mjs from data/civic/*.json. Do not edit by hand.
-- ${interps.length} documented challenges (open interpellations) and ${promises.length} tracked projects (promises),
-- published by the editorial account @${EDITOR_HANDLE}. Safe to re-run: existing rows are left as they are.
set search_path = politique, extensions, public;
do $$ begin
  if not exists (select 1 from politique.profiles where handle = '${EDITOR_HANDLE}') then
    raise exception 'editorial account @${EDITOR_HANDLE} is missing: run supabase/seed/editorial_account.sql first';
  end if;
end $$;
`);
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
// The posts get distinct timestamps a second apart (in file order) so the feed keeps a stable order.
const withPost = interps.filter((r) => r.post);
const noPost = interps.filter((r) => !r.post);
let n = withPost.length;
for (const part of chunk(withPost, 40)) {
  out.push(`insert into posts (id, author_id, kind, text, lang, commune_id, created_at)
select v.post::uuid, ed.id, 'post', v.text, 'fr', o.commune_id, now() - make_interval(secs => v.n)
from (values
${part.map((r) => `(${q(r.post)}, ${q(r.office)}, ${q(r.text)}, ${n--})`).join(",\n")}
) v(post, office, text, n)
join officials o on o.office_key = v.office
cross join (select id from profiles where handle = '${EDITOR_HANDLE}') ed
on conflict (id) do nothing;

insert into interpellations (id, author_id, official_id, post_id, title, body, created_at)
select v.id::uuid, ed.id, o.id, v.post::uuid, v.title, v.body, p.created_at
from (values
${part.map((r) => `(${q(r.id)}, ${q(r.post)}, ${q(r.office)}, ${q(r.title)}, ${q(r.body)})`).join(",\n")}
) v(id, post, office, title, body)
join officials o on o.office_key = v.office
join posts p on p.id = v.post::uuid
cross join (select id from profiles where handle = '${EDITOR_HANDLE}') ed
on conflict (id) do nothing;
`);
}
for (const part of chunk(noPost, 60)) {
  out.push(`insert into interpellations (id, author_id, official_id, title, body)
select v.id::uuid, ed.id, o.id, v.title, v.body
from (values
${part.map((r) => `(${q(r.id)}, ${q(r.office)}, ${q(r.title)}, ${q(r.body)})`).join(",\n")}
) v(id, office, title, body)
join officials o on o.office_key = v.office
cross join (select id from profiles where handle = '${EDITOR_HANDLE}') ed
on conflict (id) do nothing;
`);
}
for (const part of chunk(promises, 60)) {
  out.push(`insert into promises (id, official_id, title, description, source_url, made_at, due_at, status, status_note, created_by, verified_by)
select v.id::uuid, o.id, v.title, v.description, v.source_url, v.made_at::date, v.due_at::date, v.status::promise_status, v.status_note, ed.id, ed.id
from (values
${part.map((r) => `(${q(r.id)}, ${q(r.office)}, ${q(r.title)}, ${q(r.description)}, ${q(r.source_url)}, ${q(r.made_at)}, ${q(r.due_at)}, ${q(r.status)}, ${q(r.status_note)})`).join(",\n")}
) v(id, office, title, description, source_url, made_at, due_at, status, status_note)
join officials o on o.office_key = v.office
cross join (select id from profiles where handle = '${EDITOR_HANDLE}') ed
on conflict (id) do nothing;
`);
}
writeFileSync(path.join(here, "../supabase/seed/civic.sql"), out.join("\n"));
console.log(`civic.sql: ${withPost.length} challenges (+${noPost.length} to deputies), ${promises.length} projects, ${new Set([...interps, ...promises].map((r) => r.office)).size} offices`);
