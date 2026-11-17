// Builds the POLITIQUE editions of the state documents library.
// Usage: npm run library
//
// For every entry of lib/library.ts that has an edition, reads data/library/<id>.json,
// typesets it as a book (A5, cover, notice, contents, articles) and prints it to
// public/bibliotheque/<id>.pdf with Chromium. Then zips every edition into
// public/bibliotheque/politique-bibliotheque.zip and records sizes in data/library/built.json.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { brand, markSvg } from "../lib/brand.ts";
import { EDITION_NOTICE, articleLabel, library, ordinal, sectionLabel, type Edition, type EditionBlock } from "../lib/library.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "public/bibliotheque");
mkdirSync(out, { recursive: true });
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const font = (f: string) => `data:font/woff2;base64,${readFileSync(path.join(root, "app/fonts", f)).toString("base64")}`;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const month = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date());

function body(blocks: EditionBlock[]) {
  let html = "";
  for (const b of blocks) {
    if (b.type === "preambule") html += `<section class="preambule"><h2 class="titre-name">${esc(b.title)}</h2>${b.paras.map((p) => `<p>${esc(p)}</p>`).join("")}</section>`;
    else if (b.type === "livre") html += `<h2 class="livre"><span class="titre-num">Livre ${ordinal(b.num)}</span><span class="titre-name">${esc(b.title)}</span></h2>`;
    else if (b.type === "titre") html += `<h2 class="titre"><span class="titre-num">Titre ${ordinal(b.num)}</span><span class="titre-name">${esc(b.title)}</span></h2>`;
    else if (b.type === "section") html += `<h4 class="section">${esc(sectionLabel(b))} · ${esc(b.title)}</h4>`;
    else if (b.type === "chapitre") html += `<h3 class="chapitre"><span>Chapitre ${b.num === "1" ? "premier" : b.num}${b.nouveau ? " (nouveau)" : ""}</span>${esc(b.title)}</h3>`;
    else if (b.type === "article") html += `<article><h4>${articleLabel(b)}</h4>${b.paras.map((p) => `<p${/^[—-] /.test(p) ? ' class="item"' : ""}>${esc(p)}</p>`).join("")}</article>`;
    else html += `<p class="signature">${b.paras.map(esc).join("<br>")}</p>`;
  }
  return html;
}

function contents(blocks: EditionBlock[]) {
  // Codes list their books and titles; other texts their titles.
  const levels = blocks.some((b) => b.type === "livre") ? ["livre", "titre"] : ["titre"];
  const heads = blocks.filter((b): b is Extract<EditionBlock, { type: "titre" | "livre" }> => levels.includes(b.type));
  return `<ol class="toc">${heads.map((t) => `<li class="${t.type}"><span>${t.type === "livre" ? "Livre" : "Titre"} ${t.num}</span>${esc(t.title)}</li>`).join("")}</ol>`;
}

function page(e: Edition, version: string, part: "cover" | "book") {
  const mark = markSvg();
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(e.title)} · Édition POLITIQUE</title><style>
@font-face{font-family:Inter;src:url(${font("inter-latin.woff2")}) format("woff2");font-weight:100 900}
@font-face{font-family:Grotesk;src:url(${font("space-grotesk-latin.woff2")}) format("woff2");font-weight:300 700}
@page{size:A5;margin:18mm 16mm 20mm}
${part === "cover" ? "@page{margin:0}" : ""}
*{box-sizing:border-box}
body{margin:0;font-family:Inter,sans-serif;font-size:9.6pt;line-height:1.55;color:${brand.ink};font-feature-settings:"liga","kern"}
.cover{height:210mm;width:148mm;background:${brand.inkDeep};color:#fff;padding:22mm 16mm 16mm;display:flex;flex-direction:column;page-break-after:always;position:relative;overflow:hidden}
.cover .band{position:absolute;left:0;right:0;top:0;height:4mm;background:linear-gradient(90deg,${brand.orange} 0 33.3%,#fff 33.3% 66.6%,${brand.green} 66.6%)}
.cover .brand{font-family:Grotesk;font-weight:700;letter-spacing:.18em;font-size:10pt;display:flex;align-items:center;gap:3mm}
.cover .brand svg{width:11mm;height:11mm}
.cover .kicker{margin-top:auto;font-size:8.5pt;letter-spacing:.14em;text-transform:uppercase;color:${brand.orange};font-weight:600}
.cover h1{font-family:Grotesk;font-weight:700;font-size:25pt;line-height:1.08;margin:3mm 0 5mm}
.cover .ref{font-size:8.6pt;line-height:1.5;color:#c9cbd0;max-width:105mm}
.cover .foot{margin-top:14mm;padding-top:4mm;border-top:.3mm solid #3a3d44;font-size:7.8pt;color:#9a9da5;display:flex;justify-content:space-between}
.notice{page-break-after:always;padding-top:40mm}
.notice h2{font-family:Grotesk;font-size:12pt;margin:0 0 3mm}
.notice p{color:#4a4e57;font-size:8.6pt}
.toc-page{page-break-after:always}
.toc-page h2{font-family:Grotesk;font-size:15pt;margin:0 0 6mm}
.toc{list-style:none;margin:0;padding:0}
.toc li{padding:1.6mm 0;border-bottom:.2mm solid #e6e2da;font-size:7.6pt;letter-spacing:.03em;display:flex}
.toc li span{flex:none;width:30mm;color:${brand.green};font-weight:600;font-size:8pt;text-transform:uppercase;letter-spacing:.06em}
.preambule{page-break-after:always}
.preambule p{text-align:justify;hyphens:auto;margin:0 0 2.2mm}
h2.titre{page-break-before:always;margin:0 0 7mm;padding-top:22mm}
h2.livre{page-break-before:always;margin:0;padding:60mm 0 0;min-height:150mm;page-break-after:always}
h2.livre .titre-name{font-size:21pt}
h2.livre + h2.titre{page-break-before:avoid}
.toc li.livre{border-bottom:.3mm solid ${brand.ink};font-weight:700;padding-top:3mm}
.toc li.titre{padding-left:4mm}
h4.section{font-size:8pt;letter-spacing:.06em;text-transform:uppercase;color:#4a4e57;margin:5mm 0 2mm;break-after:avoid}
.titre-num{display:block;font-size:8.5pt;letter-spacing:.16em;text-transform:uppercase;color:${brand.orange};font-weight:600}
.titre-name{display:block;font-family:Grotesk;font-size:16pt;line-height:1.15;font-weight:700;margin-top:2mm}
.preambule .titre-name{margin:0 0 6mm;padding-top:22mm}
h3.chapitre{font-family:Grotesk;font-size:11pt;margin:7mm 0 3mm;padding-bottom:2mm;border-bottom:.3mm solid ${brand.green};break-after:avoid}
h3.chapitre span{display:block;font-family:Inter;font-size:7.5pt;letter-spacing:.12em;text-transform:uppercase;color:${brand.green};font-weight:600;margin-bottom:.8mm}
article{margin:0 0 3.2mm}
article h4{font-size:8.6pt;font-weight:700;margin:0 0 .8mm;color:${brand.ink};break-after:avoid;letter-spacing:.01em}
article p{margin:0 0 1.3mm;text-align:justify;hyphens:auto;orphans:2;widows:2}
article p.item{padding-left:4mm;text-indent:-4mm}
.signature{margin-top:8mm;text-align:right;font-style:italic}
</style></head><body>
${part === "cover" ? `<section class="cover"><div class="band"></div>
<div class="brand"><svg viewBox="0 120 1024 680" aria-hidden="true">${mark}</svg>POLITIQUE</div>
<div class="kicker">Bibliothèque de l'État · Édition POLITIQUE</div>
<h1>${esc(e.title.replace("Constitution de la République de Côte d’Ivoire", "Constitution de la République de Côte d'Ivoire"))}</h1>
<div class="ref">${esc(e.reference)}</div>
<div class="foot"><span>${esc(version)}</span><span>politique.prototypex.org</span></div>
</section>` : `<section class="notice"><h2>Avertissement</h2><p>${esc(EDITION_NOTICE)}</p><p>Texte établi d'après : ${esc(e.source)}. Mise en page : POLITIQUE, ${month}. Signalez toute erreur depuis la page du texte sur politique.prototypex.org/bibliotheque.</p></section>
<section class="toc-page"><h2>Sommaire</h2>${contents(e.blocks)}</section>
${body(e.blocks)}`}
</body></html>`;
}

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const built: { editions: Record<string, { pages: number; bytes: number; articles: number }>; archive: { bytes: number } } = { editions: {}, archive: { bytes: 0 } };
const files: string[] = [];
for (const entry of library.filter((x) => x.edition)) {
  const e = JSON.parse(readFileSync(path.join(root, "data/library", `${entry.id}.json`), "utf8")) as Edition;
  const dest = path.join(out, `${entry.id}.pdf`);
  const parts: string[] = [];
  for (const part of ["cover", "book"] as const) {
    const tab = await browser.newPage();
    await tab.setContent(page(e, entry.edition!.version, part), { waitUntil: "load" });
    await tab.evaluate(() => document.fonts.ready);
    const file = path.join(out, `.${entry.id}-${part}.pdf`);
    await tab.pdf({
      path: file,
      format: "A5",
      printBackground: true,
      displayHeaderFooter: part === "book",
      headerTemplate: "<span></span>",
      footerTemplate: `<div style="width:100%;font:7px Helvetica,Arial,sans-serif;color:#8a8d94;padding:0 16mm;display:flex;justify-content:space-between"><span>${esc(entry.short)} · Édition POLITIQUE</span><span class="pageNumber"></span></div>`,
    });
    await tab.close();
    parts.push(file);
  }
  execFileSync("pdfunite", [...parts, dest]);
  for (const f of parts) rmSync(f);
  const pdf = readFileSync(dest, "latin1");
  const pages = (pdf.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  built.editions[entry.id] = { pages, bytes: statSync(dest).size, articles: e.blocks.filter((b) => b.type === "article").length };
  files.push(`${entry.id}.pdf`);
  console.log(`${entry.id}: ${pages} pages, ${Math.round(statSync(dest).size / 1024)} Ko`);
}
await browser.close();

const zip = path.join(out, "politique-bibliotheque.zip");
rmSync(zip, { force: true });
writeFileSync(path.join(out, "LISEZMOI.txt"), `Bibliothèque de l'État, éditions POLITIQUE (${month}).\r\n\r\n${EDITION_NOTICE}\r\n\r\nTextes : ${library.filter((x) => x.edition).map((x) => x.title).join(" ; ")}.\r\nSource et mises à jour : https://politique.prototypex.org/bibliotheque\r\n`);
execFileSync("zip", ["-q", "-X", "-j", zip, ...files.map((f) => path.join(out, f)), path.join(out, "LISEZMOI.txt")]);
rmSync(path.join(out, "LISEZMOI.txt"));
built.archive.bytes = statSync(zip).size;
writeFileSync(path.join(root, "data/library/built.json"), JSON.stringify(built, null, 1) + "\n");
console.log(`archive: ${Math.round(built.archive.bytes / 1024)} Ko`);
