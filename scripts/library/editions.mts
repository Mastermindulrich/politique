// How each POLITIQUE edition is cut out of its official source text (see parse-text.mts).
import type { EditionBlock } from "../../lib/library.ts";

export type TextConfig = {
  id: string;
  source: string;
  title: string;
  reference: string;
  sourceLabel: string;
  /** First line of the text proper (title pages and tables of contents are left out). */
  start?: RegExp;
  /** Line where the text stops (excluded). */
  end?: RegExp;
  /** Running headers and other lines that are not part of the text. */
  skip?: RegExp[];
  /** Text before the first heading goes in a block with this title. */
  preamble?: string;
  /** Line that opens the closing formula (date and signatures). */
  signature?: RegExp;
  /** Whole-line corrections of obvious extraction errors: [line as extracted, line]. */
  fixes?: [string, string][];
  /** Heading titles to correct (broken line order or typos in the source): [as extracted]: title. */
  retitle?: Record<string, string>;
  post?: (blocks: EditionBlock[]) => EditionBlock[];
  /** "loidici": web text crawled from loidici.biz (one line per paragraph, headings from page titles). */
  format?: "loidici";
  /** loidici pages to leave out, by title (an abrogated text linked from the index). */
  skipPage?: RegExp;
  /** loidici page where the text stops (decrees and amending texts linked after it). */
  endPage?: RegExp;
};

export const configs: TextConfig[] = [
  {
    id: "code-electoral",
    source: "code-electoral",
    title: "Code électoral",
    reference: "Ordonnance n° 2020-356 du 8 avril 2020 portant révision du Code électoral",
    sourceLabel: "texte de l'ordonnance publié par la Commission électorale indépendante (cei.ci)",
    start: /^LE PRESIDENT DE LA REPUBLIQUE,$/,
    preamble: "Ordonnance n° 2020-356 du 8 avril 2020",
    signature: /^Fait à Abidjan, le/,
    retitle: { "DE INCOMPATIBILITES L’ELIGIBILITE, DE L’INELIGIBILITE ET DES": "DE L’ELIGIBILITE, DE L’INELIGIBILITE ET DES INCOMPATIBILITES" },
  },
  {
    id: "reglement-assemblee-nationale",
    source: "reglement-assemblee-nationale",
    title: "Règlement de l'Assemblée nationale",
    reference: "Résolution n° 005 A du 27 juillet 2018 portant Règlement de l'Assemblée nationale",
    sourceLabel: "texte publié par l'Assemblée nationale (assnat.ci)",
    start: /^LIVRE PREMIER/,
    signature: /^Fait et adopté en séance publique/,
    retitle: { "DISCPLINE ET IMMUNITES": "DISCIPLINE ET IMMUNITES" },
  },
  {
    id: "loi-cei",
    source: "loi-cei",
    title: "Loi relative à la Commission électorale indépendante",
    reference: "Loi n° 2001-634 du 9 octobre 2001 portant composition, organisation, attributions et fonctionnement de la Commission électorale indépendante, modifiée (compilation à jour en mars 2020)",
    sourceLabel: "compilation publiée par la Commission électorale indépendante (cei.ci)",
    start: /^CHAPITRE PREMIER/,
  },
  {
    id: "code-procedure-penale",
    source: "loidici-cpp-2018",
    format: "loidici",
    skipPage: /ABROG|PARQUET GENERAL/,
    title: "Code de procédure pénale",
    reference: "Loi n° 2018-975 du 27 décembre 2018 portant Code de procédure pénale, modifiée",
    sourceLabel: "texte consolidé saisi par loidici.biz d'après le Journal officiel",
  },
  {
    id: "loi-conseil-constitutionnel",
    source: "loidici-cc-2022",
    format: "loidici",
    skipPage: /ABROG/,
    title: "Loi organique sur le Conseil constitutionnel",
    reference: "Loi organique n° 2022-222 du 25 mars 2022 déterminant l'organisation et le fonctionnement du Conseil constitutionnel",
    sourceLabel: "texte saisi par loidici.biz d'après le Journal officiel",
  },
  {
    id: "code-penal",
    source: "loidici-cp-2019",
    format: "loidici",
    skipPage: /ABROG|ETABLISSEMENTS PENITENTIAIRES/,
    retitle: { "DISPOSITIONS GENERALE": "DISPOSITIONS GENERALES" },
    title: "Code pénal",
    reference: "Loi n° 2019-574 du 26 juin 2019 portant Code pénal, modifiée",
    sourceLabel: "texte consolidé saisi par loidici.biz d'après le Journal officiel",
  },
  {
    id: "loi-cour-des-comptes",
    source: "loidici-cdc-2018",
    format: "loidici",
    fixes: [["SECTION :", "SECTION PRELIMINAIRE :"]],
    skipPage: /ABROG/,
    title: "Loi organique sur la Cour des comptes",
    reference: "Loi organique n° 2018-979 du 27 décembre 2018 déterminant les attributions, la composition, l'organisation et le fonctionnement de la Cour des comptes",
    sourceLabel: "texte saisi par loidici.biz d'après le Journal officiel",
  },
  {
    id: "loi-successions",
    source: "loidici-successions-2019",
    format: "loidici",
    skipPage: /ABROG/,
    skip: [/LOIDICI\.BIZ/i],
    title: "Loi relative aux successions",
    reference: "Loi n° 2019-573 du 26 juin 2019 relative aux successions",
    sourceLabel: "texte saisi par loidici.biz d'après le Journal officiel",
  },
  {
    id: "code-travail",
    source: "loidici-travail-2015",
    format: "loidici",
    retitle: { "DISPOSITIONS TRANSITOIRES ET FINALES (Les articles 103, 104, 105, 106, 107, 108 et 109 n’existent pas dans le Code du Travail)": "DISPOSITIONS TRANSITOIRES ET FINALES" },
    endPage: /ABROG|^(ORDONNANCE|DECRET|ARRETE|LOI N|LA CONVENTION)/,
    skipPage: /ABROG/,
    skip: [/LOIDICI\.BIZ/i],
    title: "Code du travail",
    reference: "Loi n° 2015-532 du 20 juillet 2015 portant Code du travail, modifiée",
    sourceLabel: "texte saisi par loidici.biz d'après le Journal officiel",
  },
  {
    id: "loi-minorite",
    source: "loidici-minorite-2019",
    format: "loidici",
    endPage: /ABROG|^(COMITE|LES NORMES|LOI)/,
    // The site numbers the last chapter 10 and notes that it is the ninth.
    post: (blocks) => blocks.map((b) => (b.type === "chapitre" && b.num === "10" ? { ...b, num: "9", title: "DISPOSITIONS FINALES" } : b)),
    skipPage: /ABROG/,
    skip: [/LOIDICI\.BIZ/i],
    title: "Loi relative à la minorité",
    reference: "Loi n° 2019-572 du 26 juin 2019 relative à la minorité",
    sourceLabel: "texte saisi par loidici.biz d'après le Journal officiel",
  },
  {
    id: "loi-mariage",
    source: "loidici-mariage-2019",
    format: "loidici",
    endPage: /ABROG|^(LIVRET|LA COMMISSION)/,
    skipPage: /ABROG/,
    skip: [/LOIDICI\.BIZ/i],
    title: "Loi relative au mariage",
    reference: "Loi n° 2019-570 du 26 juin 2019 relative au mariage",
    sourceLabel: "texte saisi par loidici.biz d'après le Journal officiel",
  },
];
