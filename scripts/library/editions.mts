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
    id: "code-penal",
    source: "code-penal-assnat",
    title: "Code pénal",
    reference: "Loi n° 2019-574 du 26 juin 2019 portant Code pénal",
    sourceLabel: "texte de la loi publié par l'Assemblée nationale (assnat.ci)",
    start: /^LIVRE I\b/,
  },
];
