// The state documents library ("Bibliothèque"): the texts that set the rules of the
// country. Each entry links the official source; entries with `edition` also have a
// POLITIQUE edition (typeset from the official text) that can be read online and
// downloaded as a PDF. Editions are built by `npm run library`.
//
// Legal basis for the editions: in Côte d'Ivoire, official legislative, administrative
// and judicial texts are not protected by copyright (loi n° 2016-555 du 26 juillet 2016
// relative au droit d'auteur et aux droits voisins, art. 10). Only the version
// published in the Journal officiel is authoritative; every edition says so.

export type LibraryCategory = "fondamental" | "institutions" | "elections" | "codes";

export type LibraryEntry = {
  id: string;
  title: string;
  short: string;
  category: LibraryCategory;
  reference: string;
  summary: string;
  officialUrl: string;
  officialLabel: string;
  /** A POLITIQUE edition exists: data/library/<id>.json and public/bibliotheque/<id>.pdf. */
  edition?: { version: string };
};

export const CATEGORY_LABEL: Record<LibraryCategory, { fr: string; en: string }> = {
  fondamental: { fr: "Loi fondamentale", en: "Fundamental law" },
  institutions: { fr: "Fonctionnement des institutions", en: "How institutions work" },
  elections: { fr: "Élections", en: "Elections" },
  codes: { fr: "Codes", en: "Codes" },
};

export const library: LibraryEntry[] = [
  {
    id: "constitution",
    title: "Constitution de la République de Côte d'Ivoire",
    short: "Constitution",
    category: "fondamental",
    reference: "Loi n° 2016-886 du 8 novembre 2016, modifiée par les lois constitutionnelles n° 2020-348 du 19 mars 2020 et n° 2023-693 du 25 juillet 2023",
    summary: "La loi fondamentale : droits et devoirs, Président et vice-Président de la République, Gouvernement, Parlement, justice, Conseil constitutionnel, collectivités territoriales et révision.",
    officialUrl: "https://www.assnat.ci/CONSTITUTION.pdf",
    officialLabel: "Assemblée nationale",
    edition: { version: "Texte en vigueur au 15 novembre 2026" },
  },
  {
    id: "code-electoral",
    title: "Code électoral",
    short: "Code électoral",
    category: "elections",
    reference: "Loi n° 2000-514 du 1er août 2000 portant Code électoral, modifiée notamment par l'ordonnance n° 2020-356 du 8 avril 2020",
    summary: "Qui peut voter et être élu, les listes électorales, la campagne, le vote, le dépouillement et le contentieux, pour chaque élection.",
    officialUrl: "https://www.assnat.ci/Code-Electoral.pdf",
    officialLabel: "Assemblée nationale",
  },
  {
    id: "reglement-assemblee-nationale",
    title: "Règlement de l'Assemblée nationale",
    short: "Règlement de l'Assemblée",
    category: "institutions",
    reference: "Résolution n° 005 A du 27 juillet 2018 portant Règlement de l'Assemblée nationale",
    summary: "Comment l'Assemblée s'organise et travaille : bureau, groupes, commissions, séances, procédure législative et contrôle du Gouvernement.",
    officialUrl: "https://www.assnat.ci/reglement-assembleenationaledecotedivoire.pdf",
    officialLabel: "Assemblée nationale",
  },
];

/** Texts the library will carry next; shown so readers know what is coming. */
export const upcoming = [
  "Règlement du Sénat",
  "Code pénal et Code de procédure pénale",
  "Code civil (personnes, famille, successions)",
  "Code du travail",
  "Loi sur les collectivités territoriales",
  "Lois organiques sur le Conseil constitutionnel, la CEI et la Cour des comptes",
];

/** Written by `npm run library`: size of each built edition PDF and of the full archive. */
export { default as builtEditions } from "../data/library/built.json" with { type: "json" };

export const libraryById = new Map(library.map((e) => [e.id, e]));

// Structure of an edition file (data/library/<id>.json).
export type EditionBlock =
  | { type: "preambule"; title: string; paras: string[] }
  | { type: "livre"; num: string; title: string }
  | { type: "titre"; num: string; title: string }
  | { type: "chapitre"; num: string; nouveau?: boolean; title: string }
  | { type: "section"; num: string; title: string }
  | { type: "article"; num: string; nouveau?: boolean; paras: string[] }
  | { type: "signature"; paras: string[] };
export type Edition = { id: string; title: string; reference: string; source: string; blocks: EditionBlock[] };

export function articleLabel(b: { num: string; nouveau?: boolean }) {
  return `Article ${b.num === "1" ? "premier" : b.num}${b.nouveau ? " (nouveau)" : ""}`;
}

/** "1" reads "premier" in headings (Titre premier, Chapitre premier…). */
export const ordinal = (num: string) => (num === "1" ? "premier" : num);

export const EDITION_NOTICE =
  "Édition POLITIQUE établie à partir du texte officiel, à titre d'information. Les textes officiels ne sont pas protégés par le droit d'auteur (loi n° 2016-555 du 26 juillet 2016, art. 10). Seule la version publiée au Journal officiel de la République de Côte d'Ivoire fait foi.";
