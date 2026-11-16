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
  /** officialUrl is a faithful transcription of the Journal officiel (no born-digital official text online). */
  transcription?: boolean;
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
    reference: "Ordonnance n° 2020-356 du 8 avril 2020 portant révision du Code électoral",
    summary: "Qui peut voter et être élu, les listes électorales, la campagne, le vote, le dépouillement et le contentieux, pour chaque élection.",
    officialUrl: "https://www.cei.ci/textes-de-loi/",
    officialLabel: "Commission électorale indépendante",
    edition: { version: "Texte de 2020, sans la modification de l'article 51 (ordonnance n° 2025-290 du 7 mai 2025)" },
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
    edition: { version: "Texte publié par l'Assemblée nationale" },
  },
  {
    id: "loi-cei",
    title: "Loi relative à la Commission électorale indépendante",
    short: "Loi sur la CEI",
    category: "elections",
    reference: "Loi n° 2001-634 du 9 octobre 2001 portant composition, organisation, attributions et fonctionnement de la CEI, modifiée",
    summary: "Ce qu'est la CEI, ses missions, qui la compose au niveau central et local, comment elle fonctionne et se finance.",
    officialUrl: "https://www.cei.ci/textes-de-loi/",
    officialLabel: "Commission électorale indépendante",
    edition: { version: "Compilation de la CEI à jour en 2020, sans la loi modificative n° 2022-886 du 23 novembre 2022" },
  },
  {
    id: "code-penal",
    title: "Code pénal",
    short: "Code pénal",
    category: "codes",
    reference: "Loi n° 2019-574 du 26 juin 2019 portant Code pénal, modifiée",
    summary: "Les infractions et leurs peines : règles générales de la responsabilité pénale, puis chaque crime, délit et contravention, contre l'État, les personnes et les biens.",
    officialUrl: "https://assnat.ci/IMG/pdf/loi_portant_code_penal.pdf",
    officialLabel: "Assemblée nationale (texte de 2019)",
    edition: { version: "Texte consolidé, à jour des lois n° 2021-893 du 21 décembre 2021 et n° 2024-358 de juin 2024 (saisie loidici.biz)" },
  },
  {
    id: "code-procedure-penale",
    title: "Code de procédure pénale",
    short: "Code de procédure pénale",
    category: "codes",
    reference: "Loi n° 2018-975 du 27 décembre 2018 portant Code de procédure pénale, modifiée",
    summary: "Comment la justice pénale enquête, poursuit et juge : police judiciaire, garde à vue, instruction, tribunaux, voies de recours, exécution des peines et droits des personnes poursuivies.",
    officialUrl: "https://loidici.biz/2019/06/08/le-code-de-procedure-penale-2018/",
    officialLabel: "loidici.biz",
    transcription: true,
    edition: { version: "Texte consolidé, à jour des lois n° 2022-192 du 11 mars 2022, n° 2023-894 de 2023 et n° 2024-359 du 11 juin 2024 (saisie loidici.biz)" },
  },
  {
    id: "loi-conseil-constitutionnel",
    title: "Loi organique sur le Conseil constitutionnel",
    short: "Loi sur le Conseil constitutionnel",
    category: "institutions",
    reference: "Loi organique n° 2022-222 du 25 mars 2022 déterminant l'organisation et le fonctionnement du Conseil constitutionnel",
    summary: "Composition du Conseil constitutionnel, statut de ses membres, et procédures devant lui : contrôle des lois, contentieux des élections, référendum, prestation de serment et constat de vacance.",
    officialUrl: "https://loidici.biz/2025/09/08/le-conseil-constitutionnel-2022/lois-article-par-article/plus-de-textes-de-lois/73735/naty/",
    officialLabel: "loidici.biz",
    transcription: true,
    edition: { version: "Texte de 2022 (saisie loidici.biz)" },
  },
  {
    id: "loi-cour-des-comptes",
    title: "Loi organique sur la Cour des comptes",
    short: "Loi sur la Cour des comptes",
    category: "institutions",
    reference: "Loi organique n° 2018-979 du 27 décembre 2018 déterminant les attributions, la composition, l'organisation et le fonctionnement de la Cour des comptes",
    summary: "La juridiction qui contrôle l'argent public : ses attributions, ses magistrats, le jugement des comptes publics, les fautes de gestion et l'assistance qu'elle doit au Gouvernement et au Parlement.",
    officialUrl: "https://loidici.biz/2019/06/23/la-cour-des-comptes/lois-article-par-article/les-institutions-de-la-rep/15161/naty/",
    officialLabel: "loidici.biz",
    transcription: true,
    edition: { version: "Texte de 2018 (saisie loidici.biz)" },
  },
];

/** Texts the library will carry next; shown so readers know what is coming. */
export const upcoming = [
  "Règlement du Sénat",
  "Code civil (personnes, famille, successions)",
  "Code du travail",
  "Loi sur les collectivités territoriales",
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
  | { type: "section"; num: string; title: string; /** "Paragraphe"; "" for lettered sub-headings (A-, b)…). Default "Section". */ label?: string }
  | { type: "article"; num: string; nouveau?: boolean; paras: string[] }
  | { type: "signature"; paras: string[] };
export type Edition = { id: string; title: string; reference: string; source: string; blocks: EditionBlock[] };

export function articleLabel(b: { num: string; nouveau?: boolean }) {
  return `Article ${b.num === "1" ? "premier" : b.num}${b.nouveau ? " (nouveau)" : ""}`;
}

/** "Section 2", "Paragraphe 1", or the letter of a lettered sub-heading ("A", "b)"). */
export const sectionLabel = (b: { num: string; label?: string }) =>
  b.label === "" ? (/^[a-z]$/.test(b.num) ? `${b.num})` : b.num) : `${b.label ?? "Section"} ${ordinal(b.num)}`;

/** "1" reads "premier" in headings (Titre premier, Chapitre premier…). */
export const ordinal = (num: string) => (num === "1" ? "premier" : num);

export const EDITION_NOTICE =
  "Édition POLITIQUE établie à partir du texte officiel, à titre d'information. Les textes officiels ne sont pas protégés par le droit d'auteur (loi n° 2016-555 du 26 juillet 2016, art. 10). Seule la version publiée au Journal officiel de la République de Côte d'Ivoire fait foi.";
