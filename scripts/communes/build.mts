// Builds data/communes/showcase.json: the editorial showcase of every commune
// (data/communes/editorial/*.json) merged with its public sources
// (data/communes/sources/<id>.json, fetched by the "Communes sources" workflow).
// Run with `npm run communes`.
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { communes, departmentById, regionById, slugify } from "../../lib/ci-geo.ts";

type Src = {
  id: number; name: string; title?: string; url?: string; wikidata?: string;
  coordinates?: { lat: number; lon: number } | null;
  population?: { value: number; year: string } | null;
  images?: { file: string; thumb: string; page: string; artist: string; license: string; licenseUrl?: string; description?: string; width?: number; height?: number }[];
};
type PhotoRef = string | { f: string; c?: string };
type Ed = {
  id: number; tagline: string; intro: string;
  highlights: { k: string; t: string; d: string; photo?: string }[];
  products?: string[]; events?: { t: string; when: string; d: string }[];
  photos?: PhotoRef[]; sources?: { l: string; u: string }[]; featured?: boolean;
  population?: { value: number; year: string; source: string };
};

const root = new URL("../../data/communes/", import.meta.url);
const KINDS = new Set(["site", "culture", "saveurs", "fete", "nature", "economie", "artisanat"]);
const eds = new Map<number, Ed>();
for (const f of readdirSync(new URL("editorial/", root)).filter((f) => f.endsWith(".json")).sort()) {
  for (const e of JSON.parse(readFileSync(new URL(`editorial/${f}`, root), "utf8")) as Ed[]) {
    if (eds.has(e.id)) throw new Error(`duplicate commune ${e.id} in ${f}`);
    eds.set(e.id, e);
  }
}

const problems: string[] = [];
const out = [];
for (const c of communes) {
  const d = departmentById.get(c.departmentId)!;
  const r = regionById.get(d.regionId)!;
  if (r.id === 34) continue; // diaspora
  const e = eds.get(c.id);
  if (!e) { problems.push(`missing editorial: ${c.id} ${c.name}`); continue; }
  const srcFile = new URL(`sources/${c.id}.json`, root);
  const s: Src = existsSync(srcFile) ? JSON.parse(readFileSync(srcFile, "utf8")) : { id: c.id, name: c.name };
  const byFile = new Map((s.images ?? []).map((i) => [i.file, i]));
  const photos = (e.photos ?? []).map((p) => {
    const ref = typeof p === "string" ? { f: p } : p;
    const im = byFile.get(ref.f);
    if (!im) { problems.push(`${c.name}: unknown photo ${ref.f}`); return null; }
    return { file: im.file, thumb: im.thumb, page: im.page, artist: im.artist || "Wikimedia Commons", license: im.license, licenseUrl: im.licenseUrl || undefined, caption: ref.c, width: im.width, height: im.height };
  }).filter(Boolean);
  const highlights = e.highlights.map((h) => {
    if (!KINDS.has(h.k)) problems.push(`${c.name}: unknown kind ${h.k}`);
    const photo = h.photo ? photos.findIndex((p) => p!.file === h.photo) : -1;
    return { k: h.k, t: h.t, d: h.d, ...(photo >= 0 ? { photo } : {}) };
  });
  if (e.tagline.length > 90) problems.push(`${c.name}: tagline too long`);
  const sources = [...(e.sources ?? [])];
  if (s.url && !sources.some((x) => x.u === s.url)) sources.unshift({ l: `Wikipédia : ${s.title}`, u: s.url });
  let population = e.population ? { value: e.population.value, year: e.population.year } : null;
  if (!population && s.population && s.population.value > 0) {
    population = { value: s.population.value, year: s.population.year };
    if (s.wikidata) sources.push({ l: "Wikidata (population)", u: `https://www.wikidata.org/wiki/${s.wikidata}` });
  }
  if (e.population) sources.push({ l: e.population.source, u: "" });
  out.push({
    id: c.id, slug: slugify(c.name), name: c.name, department: d.name, region: r.name, district: r.district,
    tagline: e.tagline, intro: e.intro, highlights, products: e.products ?? [], events: e.events ?? [],
    photos, population, coords: s.coordinates ? { lat: s.coordinates.lat, lon: s.coordinates.lon } : null,
    sources: sources.filter((x) => x.u || x.l), ...(e.featured ? { featured: true } : {}),
  });
}
const slugs = new Set<string>();
for (const o of out) { if (slugs.has(o.slug)) problems.push(`duplicate slug ${o.slug}`); slugs.add(o.slug); }

writeFileSync(new URL("showcase.json", root), JSON.stringify(out) + "\n");
console.log(`${out.length} showcases, ${out.reduce((a, o) => a + o.photos.length, 0)} photos`);
if (problems.length) {
  console.log(problems.join("\n"));
  if (process.argv.includes("--strict")) process.exit(1);
}
