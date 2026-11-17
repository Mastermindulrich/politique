// Découvertes: the showcase of each commune (what it has to offer: sites, culture,
// flavours, festivals, nature, economy). Editorial content lives in
// data/communes/editorial/*.json and is merged with its public sources (Wikipedia,
// Wikimedia Commons photos with their authors and licences, Wikidata population)
// by `npm run communes` into data/communes/showcase.json.
import built from "../data/communes/showcase.json" with { type: "json" };
import { communeById, departmentById, regionById, slugify } from "./ci-geo";

export type HighlightKind = "site" | "culture" | "saveurs" | "fete" | "nature" | "economie" | "artisanat";

export type Photo = {
  file: string;
  thumb: string;
  page: string;
  artist: string;
  license: string;
  licenseUrl?: string;
  caption?: string;
  width?: number;
  height?: number;
};

export type Showcase = {
  id: number;
  slug: string;
  name: string;
  department: string;
  region: string;
  district: string;
  tagline: string;
  intro: string;
  highlights: { k: HighlightKind; t: string; d: string; photo?: number }[];
  products: string[];
  events: { t: string; when: string; d: string }[];
  photos: Photo[];
  population: { value: number; year: string } | null;
  coords: { lat: number; lon: number } | null;
  sources: { l: string; u: string }[];
  featured?: boolean;
};

export const showcases = built as Showcase[];
export const showcaseById = new Map(showcases.map((s) => [s.id, s]));
export const showcaseBySlug = new Map(showcases.map((s) => [s.slug, s]));

/** The showcase slug of a commune id (every commune has one, even before its content is written). */
export function communeSlug(id: number) {
  return showcaseById.get(id)?.slug ?? slugify(communeById.get(id)?.name ?? String(id));
}

export function communePlace(id: number) {
  const c = communeById.get(id);
  const d = c && departmentById.get(c.departmentId);
  const r = d && regionById.get(d.regionId);
  return { department: d?.name ?? "", region: r?.name ?? "", district: r?.district ?? "" };
}

export const districts = Array.from(new Set(showcases.map((s) => s.district)));

export const KINDS: Record<HighlightKind, { fr: string; en: string; tone: string }> = {
  site: { fr: "À visiter", en: "Must-see", tone: "bg-green-soft text-green-deep" },
  culture: { fr: "Culture", en: "Culture", tone: "bg-orange-soft text-orange" },
  saveurs: { fr: "Saveurs", en: "Flavours", tone: "bg-orange-soft text-orange" },
  fete: { fr: "Fête", en: "Festival", tone: "bg-orange-soft text-orange" },
  nature: { fr: "Nature", en: "Nature", tone: "bg-green-soft text-green-deep" },
  economie: { fr: "Économie", en: "Economy", tone: "bg-paper text-ink" },
  artisanat: { fr: "Artisanat", en: "Crafts", tone: "bg-paper text-ink" },
};

/** Brand gradients for communes without a photo, one per district so neighbours match. */
const TONES = [
  ["#0A7A4A", "#06402A"],
  ["#F07C00", "#8A3F00"],
  ["#1F2937", "#0F1113"],
  ["#0E6B5C", "#073A33"],
  ["#B45309", "#5A2A05"],
  ["#14532D", "#0B2A18"],
];
export function coverTone(district: string) {
  const i = Math.abs([...district].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % TONES.length;
  const [a, b] = TONES[i]!;
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

/** The town hall's own additions (table commune_showcases), when it has written some. */
export type TownHallShowcase = {
  commune_id: number;
  tagline: string | null;
  message: string | null;
  event_title: string | null;
  event_date: string | null;
  event_text: string | null;
  website: string | null;
  updated_by: string | null;
  updated_at: string;
};

export const formatPopulation = (n: number, lang: "fr" | "en") => new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-GB").format(n);

/** A photo at one of Wikimedia's standard thumbnail widths (500 for cards, 960 for the cover). */
export function photoUrl(p: Photo, w: 250 | 500 | 960) {
  const clean = p.thumb.split("?")[0]!;
  if (p.width && p.width <= w) return clean;
  return clean.replace(/\/\d+px-/, `/${w}px-`);
}

/** Folds accents and case, so "Beoumi" finds "Béoumi". */
export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
