// Turns the text extracted from an official PDF (data/library/sources/<source>.txt) into a
// POLITIQUE edition file (data/library/<id>.json): livres, titres, chapitres, sections and
// articles, with the paragraphs of each article rebuilt from the PDF's wrapped lines.
//   node --experimental-strip-types scripts/library/parse-text.mts [id ...]
// It prints the article sequence checks (gaps, repeats) so that every edition is reviewed.
import { readFileSync, writeFileSync } from "node:fs";
import type { Edition, EditionBlock } from "../../lib/library.ts";
import { configs, type TextConfig } from "./editions.mts";

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };
const roman = (s: string) => {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const v = ROMAN[s[i]], next = ROMAN[s[i + 1]] ?? 0;
    n += v < next ? -v : v;
  }
  return n;
};
/** "PREMIER", "1er", "II", "3" -> "1", "2", "3"; "PRELIMINAIRE" -> "préliminaire". */
function headNum(raw: string) {
  const s = raw.replace(/\s+/g, "").replace(/er$/i, "");
  if (/^premi/i.test(s)) return "1";
  if (/^pr[ée]liminaire$/i.test(s)) return "préliminaire";
  if (/^unique$/i.test(s)) return "unique";
  if (/^[IVXLC]+$/.test(s)) return String(roman(s));
  return s;
}

const NUM = String.raw`(PREMIER|PRELIMINAIRE|PRÉLIMINAIRE|UNIQUE|premier|préliminaire|unique|1er|[IVXLC]+|\d+)`;
const SEP = String.raw`\s*(?:[:.–—-]+\s*)?`;
const HEAD: { type: "livre" | "titre" | "chapitre" | "section"; label?: string; re: RegExp }[] = [
  { type: "livre", re: new RegExp(`^LIVRE\\s+${NUM}\\b${SEP}(.*)$`) },
  { type: "titre", re: new RegExp(`^TITRE\\s+${NUM}\\b${SEP}(.*)$`) },
  { type: "chapitre", re: new RegExp(`^CHAPITRE\\s+${NUM}\\b${SEP}(.*)$`) },
  { type: "section", re: new RegExp(`^(?:SECTION|Section)\\s+${NUM}\\b${SEP}(.*)$`) },
  // Lettered sub-divisions in upper case ("A- COMMISSIONS PERMANENTES").
  { type: "section", label: "Paragraphe", re: new RegExp(`^PARAGRAPHE\\s+${NUM}\\b${SEP}(.*)$`) },
  { type: "section", label: "", re: /^([A-H])\s*[-–.]\s*([A-ZÀ-Ý][^a-zà-ÿ]{3,})$/ },
];
// "ARTICLE 2", "Article 5 nouveau (loi n°2019-708 du 05 AOUT 2019):", "Article 3 :", "Art. 12. — Text".
// The heading must stand alone on its line (or, for "Art.", be followed by a dash), so that a
// wrapped line starting with "Article 12 de la loi…" is not taken for a heading.
const ARTICLE = /^(?:ARTICLE|Article)\s+(PREMIER|premier|1er|\d+(?:\s+(?:bis|ter|quater|quinquies))?)(\s*:?\s*nouveau)?\s*:?\s*(\([^)]*\))?\s*[:.–—-]?$|^Art\.\s+(1er|\d+(?:\s+(?:bis|ter))?)\s*\.?\s*[–—-]+\s*(.*)$/;
const ARTICLE_INLINE = /^(?:ARTICLE|Article)\s+(PREMIER|premier|1er|\d+)\s*[:.–—-]?\s+([A-ZÀ-Ý«].*)$/;
const LIST = /^(?:[-–•▪]\s|\d+[°)]|\d+\s*[-–.]\s|[a-z]\)|[ivx]+\)|[IVX]+\s*[-–.]\s)/;
const END = /[.;:!?»…]$/;
const isUpper = (s: string) => /[A-ZÀ-Ý]/.test(s) && !/[a-zà-ÿ]/.test(s);

/** Joins the wrapped lines of one block of text into paragraphs. */
function paragraphs(lines: string[], opts: { comma?: boolean } = {}) {
  const out: string[] = [];
  for (const line of lines) {
    const prev = out[out.length - 1];
    const closed = prev !== undefined && (END.test(prev) || /^\(.*\)$/.test(prev) || (opts.comma && /,$/.test(prev) && !/^Vu$/.test(prev)));
    if (prev === undefined || closed || LIST.test(line)) out.push(line);
    else if (/[a-zà-ÿ]-$/.test(prev) && /^[a-zà-ÿ]/.test(line)) out[out.length - 1] = prev + line;
    else out[out.length - 1] = `${prev} ${line}`;
  }
  return out.map((p) => p.replace(/([.;:])\s+\d{1,3}$/, "$1").replace(/(\d°)(?=[a-zà-ÿA-Z])/g, "$1 ").replace(/\s+/g, " ").replace(/\s+([,.;:])(?=\s|$)/g, (m, c) => (c === ":" || c === ";" ? ` ${c}` : c)).trim()).filter(Boolean);
}

export function parse(cfg: TextConfig): Edition {
  const raw = readFileSync(`data/library/sources/${cfg.source}.txt`, "utf8").replace(/\r/g, "");
  let lines = raw.split(/\n|\f/).map((l) => l.replace(/­/g, "").replace(/[ \t ]+/g, " ").trim());
  const start = cfg.start ? lines.findIndex((l) => cfg.start!.test(l)) : 0;
  if (start < 0) throw new Error(`${cfg.id}: start not found`);
  lines = lines.slice(start);
  if (cfg.end) {
    const end = lines.findIndex((l) => cfg.end!.test(l));
    if (end >= 0) lines = lines.slice(0, end);
  }
  // Bullets the PDF extracts on their own lines, apart from their items (and not always
  // one per item), are left out: each item still starts its own paragraph.
  lines = lines.filter((l) => l && !/^\d{1,3}$/.test(l) && !/^[-_–—.\s]+$/.test(l) && !(cfg.skip ?? []).some((re) => re.test(l)));
  for (const [from, to] of cfg.fixes ?? []) lines = lines.map((l) => (l === from ? to : l));

  const blocks: EditionBlock[] = [];
  let body: string[] = [];
  let current: EditionBlock | null = null;
  let pendingTitle: Extract<EditionBlock, { title: string }> | null = null;
  const flush = () => {
    if (!current) return;
    if (current.type === "article") current.paras = paragraphs(body);
    else if (current.type === "preambule") current.paras = paragraphs(body, { comma: true });
    else if (current.type === "signature") current.paras = [...body];
    body = [];
  };
  if (cfg.preamble) current = { type: "preambule", title: cfg.preamble, paras: [] };

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (cfg.signature?.test(l)) {
      flush();
      if (current) blocks.push(current);
      current = { type: "signature", paras: [] };
      pendingTitle = null;
      body.push(l);
      continue;
    }
    // "b) Question préalable…" standing just before an article is a sub-heading.
    const sub = l.match(/^([a-h])\)\s+([A-ZÀ-Ý][^.;:]*)$/);
    if (sub && ARTICLE.test(lines[i + 1] ?? "")) {
      flush();
      if (current) blocks.push(current);
      current = null;
      pendingTitle = null;
      blocks.push({ type: "section", label: "", num: sub[1], title: sub[2] });
      continue;
    }
    const head = HEAD.find((h) => h.re.test(l));
    if (head && current?.type !== "signature") {
      const m = l.match(head.re)!;
      flush();
      if (current) blocks.push(current);
      current = null;
      const b = { type: head.type, num: head.label === "" ? m[1] : headNum(m[1]), title: m[2].trim(), ...(head.label !== undefined ? { label: head.label } : {}) } as Extract<EditionBlock, { title: string }>;
      blocks.push(b);
      pendingTitle = b;
      continue;
    }
    // "Article 68 Les Commissions peuvent…": heading and text on one line, accepted only
    // after a line that closes a sentence (a wrapped cross-reference does not).
    const inline = !ARTICLE.test(l) && (!current || END.test(lines[i - 1] ?? ".")) ? l.match(ARTICLE_INLINE) : null;
    const art = l.match(ARTICLE) ?? (inline ? [inline[0], inline[1], undefined, undefined, undefined, inline[2]] : null);
    if (art && current?.type !== "signature") {
      flush();
      if (current) blocks.push(current);
      pendingTitle = null;
      const n = art[1] ?? art[4];
      const num = /^(premier|1er)$/i.test(n) ? "1" : n.replace(/\s+/g, " ");
      current = { type: "article", num, paras: [], ...(art[2] ? { nouveau: true } : {}) };
      if (art[3]) body.push(art[3]);
      if (art[5]) body.push(art[5]);
      continue;
    }
    if (pendingTitle) {
      // A heading's title can run over the next lines: upper-case lines for livres, titres
      // and chapitres, lower-case continuations for sections.
      const t = pendingTitle.title;
      const cont = !t || (isUpper(t) && isUpper(l)) || /^[a-zà-ÿ(]/.test(l) || /\b(?:de|des|du|et|à|aux|la|le|les|en|DE|DES|DU|ET|A|AUX|LA|LE|LES|EN|D'|D’)$/.test(t);
      if (cont) {
        pendingTitle.title = `${t} ${l}`.replace(/\s+/g, " ").replace(/^[:.–—-]\s*/, "").trim();
        continue;
      }
      pendingTitle = null;
    }
    if (!current) throw new Error(`${cfg.id}: text outside an article: "${l}" (line ${i})`);
    body.push(l);
  }
  flush();
  if (current) blocks.push(current);

  for (const b of blocks) if ("title" in b && cfg.retitle?.[b.title]) b.title = cfg.retitle[b.title];
  return { id: cfg.id, title: cfg.title, reference: cfg.reference, source: cfg.sourceLabel, blocks: cfg.post ? cfg.post(blocks) : blocks };
}

/** Article numbers that skip or repeat, so a missed or doubled heading is caught. */
export function check(e: Edition) {
  const nums = e.blocks.filter((b) => b.type === "article").map((b) => (b as { num: string }).num);
  const seen = new Set<string>();
  const issues: string[] = [];
  let last = 0;
  for (const n of nums) {
    if (seen.has(n)) issues.push(`repeat ${n}`);
    seen.add(n);
    const v = Number.parseInt(n, 10);
    if (/^\d+$/.test(n)) {
      if (v !== last + 1) issues.push(`${last} -> ${v}`);
      last = v;
    }
  }
  const empty = e.blocks.filter((b) => b.type === "article" && b.paras.length === 0).map((b) => (b as { num: string }).num);
  if (empty.length) issues.push(`empty: ${empty.join(", ")}`);
  return { articles: nums.length, issues };
}

const ids = process.argv.slice(2);
for (const cfg of configs.filter((c) => !ids.length || ids.includes(c.id))) {
  const e = parse(cfg);
  writeFileSync(`data/library/${cfg.id}.json`, JSON.stringify(e, null, 1) + "\n");
  const { articles, issues } = check(e);
  console.log(`${cfg.id}: ${articles} articles, ${e.blocks.length} blocks${issues.length ? `\n  ${issues.join("\n  ")}` : ""}`);
}
