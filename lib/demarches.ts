// "Démarches": the administrative procedures people most often need, with the official
// place to do them (online when an official platform exists) and what to bring.
// Every entry was checked on the official site named in `source` on `checked`; amounts
// and lists change, so each page says to confirm with the issuing office.

export type DemarcheTheme = "identite" | "justice" | "etat-civil" | "transport" | "social" | "entreprise" | "elections";

export type Demarche = {
  id: string;
  title: string;
  theme: DemarcheTheme;
  summary: string;
  /** "online": done entirely online; "partial": started online (form, payment, appointment), finished in person; "office": in person only. */
  mode: "online" | "partial" | "office";
  /** Main action: the official platform, or the information page when nothing is online. */
  url: string;
  urlLabel: string;
  organisme: string;
  pieces?: string[];
  cost?: string;
  delay?: string;
  where?: string;
  steps?: string[];
  /** Other official links (tracking, mobile app, special cases). */
  links?: { l: string; u: string }[];
  note?: string;
  source: string;
  checked: string;
};

export const THEMES: Record<DemarcheTheme, { fr: string; en: string; blurb: string }> = {
  identite: { fr: "Identité et voyage", en: "Identity and travel", blurb: "Carte d'identité, passeport, carte de résident" },
  justice: { fr: "Justice", en: "Justice", blurb: "Certificat de nationalité, casier judiciaire" },
  "etat-civil": { fr: "État civil", en: "Civil status", blurb: "Naissance, mariage, décès, légalisation" },
  transport: { fr: "Permis et véhicules", en: "Licences and vehicles", blurb: "Permis de conduire, carte grise" },
  social: { fr: "Santé et protection sociale", en: "Health and social security", blurb: "CMU, CNPS" },
  entreprise: { fr: "Entreprendre et impôts", en: "Business and taxes", blurb: "Créer son entreprise, déclarer ses impôts" },
  elections: { fr: "Voter", en: "Voting", blurb: "Liste électorale, carte d'électeur" },
};

export const THEME_ORDER: DemarcheTheme[] = ["justice", "identite", "etat-civil", "elections", "social", "transport", "entreprise"];

const SP = "https://www.servicepublic.gouv.ci/accueil/detaildemarcheparticulier/1";
const CHECKED = "17 novembre 2026";

export const demarches: Demarche[] = [
  {
    id: "certificat-nationalite",
    title: "Certificat de nationalité",
    theme: "justice",
    summary: "Le document qui prouve que vous êtes ivoirien. Il est demandé pour la carte d'identité, le passeport, les concours et de nombreux dossiers.",
    mode: "online",
    url: "https://e-justice.ci/requests/cni",
    urlLabel: "Demander sur e-justice.ci",
    organisme: "Ministère de la Justice (plateforme e-justice)",
    pieces: [
      "Extrait d'acte de naissance",
      "Ivoirien par un parent : la pièce d'identité d'un parent ivoirien",
      "Par adoption : la pièce de l'adoptant ivoirien et la décision d'adoption",
      "Par mariage : la pièce du conjoint ivoirien, l'acte de mariage ou le livret de famille, l'attestation de non-opposition",
      "Par naturalisation : le décret de naturalisation (ou la page du Journal officiel) et la copie intégrale de l'acte de naissance transcrit",
    ],
    cost: "2 500 F CFA + 500 F CFA de frais de service",
    steps: [
      "Choisissez votre situation (filiation, adoption, mariage, naturalisation…) et remplissez le formulaire.",
      "Joignez les pièces et payez en ligne.",
      "Suivez la demande avec votre numéro de suivi.",
      "Le certificat vous est délivré en version numérique, une seule fois ; une nouvelle copie se demande comme duplicata.",
    ],
    links: [{ l: "Suivre une demande", u: "https://e-justice.ci/trackings" }, { l: "Questions fréquentes", u: "https://e-justice.ci/contacts#faq" }],
    source: "https://e-justice.ci/requests/cni",
    checked: CHECKED,
  },
  {
    id: "casier-judiciaire",
    title: "Casier judiciaire (bulletin n° 3)",
    theme: "justice",
    summary: "L'extrait de casier judiciaire demandé pour un emploi, un concours, une candidature à une élection ou un visa.",
    mode: "online",
    url: "https://e-justice.ci/requests/cj",
    urlLabel: "Demander sur e-justice.ci",
    organisme: "Ministère de la Justice (plateforme e-justice)",
    pieces: [
      "Extrait d'acte de naissance (original) ; né à l'étranger : en français, lisible et légalisé par une ambassade ou un consulat ivoirien",
      "Acte de mariage, si vous êtes marié(e)",
      "Jugement de séparation de corps, le cas échéant",
    ],
    cost: "2 500 F CFA + 500 F CFA de frais de service (10 000 F CFA pour un étranger né hors de Côte d'Ivoire)",
    steps: ["Choisissez votre profil (né en Côte d'Ivoire ou à l'étranger, ivoirien ou étranger).", "Joignez les pièces et payez en ligne.", "Le bulletin est délivré en version numérique sur la plateforme."],
    links: [{ l: "Suivre une demande", u: "https://e-justice.ci/trackings" }],
    source: "https://e-justice.ci/requests/cj",
    checked: CHECKED,
  },
  {
    id: "attestation-authentification",
    title: "Attestation d'authentification d'un acte de justice",
    theme: "justice",
    summary: "Pour faire vérifier qu'un acte de justice (certificat, casier, décision) est authentique.",
    mode: "online",
    url: "https://e-justice.ci/requests/aa",
    urlLabel: "Demander sur e-justice.ci",
    organisme: "Ministère de la Justice (plateforme e-justice)",
    cost: "À partir de 3 000 F CFA + 500 F CFA de frais de service",
    source: "https://e-justice.ci/",
    checked: CHECKED,
  },
  {
    id: "carte-identite",
    title: "Carte nationale d'identité (CNI)",
    theme: "identite",
    summary: "Première demande, renouvellement ou duplicata : achetez le timbre en ligne, puis faites-vous enrôler dans un centre de l'ONECI.",
    mode: "partial",
    url: "https://rnpp.ci",
    urlLabel: "Acheter le timbre d'enrôlement",
    organisme: "Office national de l'état civil et de l'identification (ONECI)",
    pieces: [
      "Première demande : justificatif de naissance de moins de 2 ans (extrait ou copie intégrale)",
      "Première demande : certificat de nationalité de moins de 2 ans (copie de la CNI d'un parent recommandée)",
      "Femme mariée : copie intégrale ou extrait portant la mention du mariage, ou acte de mariage",
      "Renouvellement : l'ancienne CNI ou sa copie, et un extrait ou une copie intégrale de naissance",
      "Duplicata : attestation de déclaration de perte, copie de la CNI perdue ou tout document portant le numéro NNI, extrait de naissance",
      "Dans tous les cas : le reçu de paiement du timbre",
    ],
    cost: "Timbre d'enrôlement : 5 000 F CFA",
    steps: [
      "Achetez le timbre en ligne (carte bancaire ou mobile money).",
      "Présentez-vous dans un centre ONECI avec le reçu et les pièces.",
      "Suivez la production de la carte en ligne, puis retirez-la avec le message de retrait (numéro ID/BL).",
    ],
    links: [
      { l: "Suivre le statut de ma CNI", u: "https://statut.oneci.ci" },
      { l: "Retrouver mon numéro NNI", u: "https://demande-nni.oneci.ci/" },
      { l: "Liste officielle des pièces (PDF)", u: "https://www.oneci.ci/downloads/files/etapes-demande-cni.pdf" },
      { l: "Diaspora : rendez-vous et pré-enrôlement", u: "https://express54.oneci.ci/" },
      { l: "Déclarer une CNI retrouvée", u: "https://www.oneci.ci/nos-produits/carte-identite/declarer-cni-retrouvee" },
    ],
    source: "https://www.oneci.ci/accueil",
    checked: CHECKED,
  },
  {
    id: "passeport",
    title: "Passeport biométrique",
    theme: "identite",
    summary: "Pré-enrôlement, rendez-vous et paiement en ligne, puis empreintes et photo à l'agence. Valable cinq ans.",
    mode: "partial",
    url: "https://monpasseport.ci/",
    urlLabel: "Se pré-enrôler sur monpasseport.ci",
    organisme: "Ministère de l'Intérieur, avec la SNEDAI",
    pieces: [
      "Une photo d'identité récente",
      "CNI en cours de validité (original et copie)",
      "Extrait de naissance original",
      "Le reçu, l'attestation de rendez-vous et le formulaire reçus par e-mail après le pré-enrôlement",
      "Commerçant : registre de commerce ; chauffeur : attestation de travail ; épouse portant le nom du mari : acte de mariage",
      "Mineur : autorisation parentale légalisée à la mairie et copie de la CNI du parent",
      "Renouvellement : l'ancien passeport (original et copie)",
    ],
    cost: "40 000 F CFA",
    delay: "72 heures après validation par la police de l'air et des frontières",
    steps: ["Créez un compte, saisissez vos informations et choisissez un rendez-vous.", "Payez en ligne (carte, Orange Money, MTN MoMo, Moov, Ecobank Pay).", "Présentez-vous à l'agence choisie avec les pièces.", "Retirez le passeport en personne, sur présentation du récépissé."],
    links: [{ l: "Suivre mon dossier", u: "https://snedai.com/suividedossierpaseport/" }, { l: "Passeport pour la diaspora", u: "https://snedai.com/passeport-pour-la-diaspora/" }],
    source: "https://snedai.com/passeport-en-cote-divoire",
    checked: CHECKED,
  },
  {
    id: "carte-resident",
    title: "Carte de résident (étrangers)",
    theme: "identite",
    summary: "Pour les étrangers qui vivent en Côte d'Ivoire : timbre en ligne pour les ressortissants CEDEAO, pré-enregistrement en ligne pour les autres.",
    mode: "partial",
    url: "https://pre-enregistrement-carte-resident.oneci.ci/#step-1",
    urlLabel: "Pré-enregistrement (hors CEDEAO)",
    organisme: "ONECI",
    links: [
      { l: "Timbre carte de résident CEDEAO", u: "https://rnpp.ci" },
      { l: "Carte de résident temporaire", u: "https://residence-temporaire.oneci.ci" },
      { l: "Demande de parrainage", u: "https://parrain-resident.oneci.ci/" },
    ],
    source: "https://rnpp.ci",
    checked: CHECKED,
  },
  {
    id: "acte-naissance",
    title: "Extrait ou copie intégrale d'acte de naissance, de mariage ou de décès",
    theme: "etat-civil",
    summary: "À demander à la mairie (ou sous-préfecture) où l'acte a été dressé, ou en ligne par La Poste, qui vous l'envoie.",
    mode: "partial",
    url: "https://documents.ci/UserRegister",
    urlLabel: "Commander en ligne avec La Poste",
    organisme: "Mairies et sous-préfectures ; La Poste de Côte d'Ivoire",
    pieces: ["Les références de l'acte : numéro, année, date, nom", "Ou une copie de l'acte"],
    cost: "À la mairie : 2 500 F CFA la copie intégrale. Par La Poste : 3 500 F CFA (même région) ou 5 000 F CFA (autre région)",
    delay: "48 heures à la mairie ; par La Poste, 5 jours ouvrés (mairie) ou 10 (sous-préfecture)",
    where: "La mairie du lieu où l'acte a été dressé",
    note: "Par La Poste, seule la personne concernée (majeure) ou ses parents directs peuvent commander ; l'acte arrive par courrier express recommandé.",
    links: [{ l: "Fiche officielle (mairie)", u: `${SP}/277/1` }, { l: "Fiche officielle (La Poste)", u: `${SP}/299/1` }],
    source: `${SP}/299/1`,
    checked: CHECKED,
  },
  {
    id: "declarer-naissance",
    title: "Déclarer une naissance",
    theme: "etat-civil",
    summary: "Toute naissance se déclare à la mairie du lieu de naissance, dans les trois mois. C'est gratuit et c'est le premier droit de l'enfant.",
    mode: "office",
    url: `${SP}/269/1`,
    urlLabel: "Fiche officielle",
    organisme: "Mairie du lieu de naissance",
    pieces: [
      "Certificat de naissance signé par le médecin ou la sage-femme, avec son numéro d'enregistrement",
      "Pièce d'identité d'un parent",
      "Acte de mariage des parents, le cas échéant",
    ],
    cost: "Gratuit (la loi sur l'état civil rend la déclaration obligatoire et gratuite)",
    delay: "Dans les 3 mois suivant la naissance",
    where: "Mairie du lieu de naissance",
    source: `${SP}/269/1`,
    checked: CHECKED,
  },
  {
    id: "declarer-deces",
    title: "Déclarer un décès",
    theme: "etat-civil",
    summary: "À faire à la mairie du lieu de décès dans les quinze jours ; l'acte de décès sert ensuite pour la succession et les pensions.",
    mode: "office",
    url: `${SP}/279/1`,
    urlLabel: "Fiche officielle",
    organisme: "Mairie du lieu de décès",
    pieces: ["Procès-verbal de constat de décès", "Pièce d'identité du défunt", "CNI du déclarant", "Acte de mariage du défunt, le cas échéant"],
    delay: "Dans les 15 jours suivant le décès",
    where: "Mairie du lieu de décès",
    source: `${SP}/279/1`,
    checked: CHECKED,
  },
  {
    id: "mariage",
    title: "Se marier à la mairie",
    theme: "etat-civil",
    summary: "Le dossier se dépose à la mairie de la commune où vit l'un des futurs époux, entre un mois et dix jours avant la date.",
    mode: "office",
    url: `${SP}/280/1`,
    urlLabel: "Fiche officielle",
    organisme: "Mairie de résidence de l'un des époux",
    pieces: [
      "Extrait de naissance de moins de 3 mois portant « délivré en vue de mariage »",
      "Certificat de résidence de moins de 6 mois pour chaque époux",
      "Copie recto verso de la pièce d'identité des époux et des témoins majeurs",
      "Une photo d'identité de chaque époux",
      "Veuf ou divorcé : acte de décès du conjoint ou jugement de divorce avec certificat de non-appel",
    ],
    note: "Les frais varient d'une commune à l'autre : renseignez-vous auprès de votre mairie.",
    source: `${SP}/280/1`,
    checked: CHECKED,
  },
  {
    id: "legalisation",
    title: "Légaliser une signature, certifier une copie",
    theme: "etat-civil",
    summary: "Dans n'importe quelle mairie, ou en ligne par La Poste.",
    mode: "partial",
    url: "https://documents.ci/UserRegister",
    urlLabel: "Commander en ligne avec La Poste",
    organisme: "Toute mairie ; La Poste de Côte d'Ivoire",
    pieces: ["Pièce d'identité du signataire (CNI, passeport ou carte de séjour)", "Le document signé (traduit en français s'il est dans une autre langue)"],
    cost: "Timbre de 500 F CFA par copie à la mairie",
    where: "Toute mairie",
    links: [{ l: "Fiche officielle", u: `${SP}/274/1` }],
    source: `${SP}/274/1`,
    checked: CHECKED,
  },
  {
    id: "attestation-domicile",
    title: "Attestation de domicile (certificat de résidence)",
    theme: "etat-civil",
    summary: "Demandée pour un mariage, une inscription ou un dossier administratif.",
    mode: "office",
    url: `${SP}/268/1`,
    urlLabel: "Fiche officielle",
    organisme: "Mairie du domicile",
    pieces: ["Imprimé de déclaration sur l'honneur (fourni par la mairie)"],
    where: "Mairie du domicile",
    source: `${SP}/268/1`,
    checked: CHECKED,
  },
  {
    id: "carte-electeur",
    title: "S'inscrire sur la liste électorale",
    theme: "elections",
    summary: "Dès 18 ans, ou après un changement d'adresse, inscrivez-vous pendant les périodes de révision ouvertes par la CEI.",
    mode: "office",
    url: "https://www.cei.ci/",
    urlLabel: "Site de la CEI",
    organisme: "Commission électorale indépendante (CEI)",
    pieces: ["CNI ou passeport en cours de validité"],
    where: "Les centres d'inscription ouverts par la CEI pendant la révision de la liste électorale",
    links: [{ l: "Fiche officielle", u: `${SP}/270/1` }],
    source: `${SP}/270/1`,
    checked: CHECKED,
  },
  {
    id: "cmu",
    title: "Couverture maladie universelle (CMU)",
    theme: "social",
    summary: "L'assurance maladie de base, obligatoire pour toute personne qui réside en Côte d'Ivoire. L'enrôlement est gratuit.",
    mode: "office",
    url: "https://www.ipscnam.ci",
    urlLabel: "Site de la CNAM",
    organisme: "Caisse nationale d'assurance maladie (CNAM)",
    cost: "Enrôlement gratuit ; cotisation de 1 000 F CFA par mois et par personne",
    delay: "Carte délivrée dans un délai d'un mois",
    where: "Les centres d'enrôlement CMU",
    links: [{ l: "Application CMU Mobile", u: "https://apps.apple.com/ci/app/cmu-mobile/id6478773682" }, { l: "Fiche officielle", u: `${SP}/191/14` }],
    note: "Numéro vert : 800 00 900.",
    source: `${SP}/191/14`,
    checked: CHECKED,
  },
  {
    id: "cnps",
    title: "CNPS : retraite, prestations et déclarations",
    theme: "social",
    summary: "Employeurs : déclarer les salariés, payer les cotisations, demander les attestations d'immatriculation. Assurés : suivre son dossier et simuler sa retraite.",
    mode: "online",
    url: "https://e-cnps.cnps.ci",
    urlLabel: "Espace e-CNPS",
    organisme: "Caisse nationale de prévoyance sociale (CNPS)",
    links: [{ l: "Application MA CNPS", u: "https://apps.apple.com/ci/app/app-macnps/id6473725928" }, { l: "Site de la CNPS", u: "https://www.cnps.ci" }],
    source: "https://e.cnps.ci/guide/employeur.pdf",
    checked: CHECKED,
  },
  {
    id: "permis-carte-grise",
    title: "Permis de conduire et carte grise",
    theme: "transport",
    summary: "Rendez-vous, duplicata de permis, carte grise, cartes de transport et suivi des dossiers se font avec CGI Digital, la plateforme du ministère des Transports.",
    mode: "partial",
    url: "https://apps.apple.com/ml/app/cgi-digital/id1611186333",
    urlLabel: "Application CGI Digital",
    organisme: "Ministère des Transports, Centres de gestion intégrés (CGI)",
    note: "Centre d'appel : 1302. Un nouveau candidat au permis prend rendez-vous sur la plateforme.",
    links: [{ l: "Pièces et frais du permis (PDF du ministère)", u: "https://www.transports.gouv.ci/sites/default/files/permis_de_conduire.pdf" }],
    source: "https://www.fratmat.info/article/2642060/economie/publi-info/delivrance-des-documents-de-transport-la-digitalisation-pour-reduire-les-delais-et-acceder-directement-aux-services",
    checked: CHECKED,
  },
  {
    id: "creer-entreprise",
    title: "Créer son entreprise",
    theme: "entreprise",
    summary: "Le guichet unique du CEPICI regroupe les formalités de création (registre du commerce, déclaration fiscale, CNPS).",
    mode: "online",
    url: "https://guif.cepici.ci/",
    urlLabel: "Guichet unique en ligne (GUIF)",
    organisme: "Centre de promotion des investissements en Côte d'Ivoire (CEPICI)",
    links: [{ l: "Informations sur la création", u: "https://cepici.ci/infos-creation-entreprise" }],
    source: "https://cepici.ci/",
    checked: CHECKED,
  },
  {
    id: "impots",
    title: "Déclarer et payer ses impôts (entreprises)",
    theme: "entreprise",
    summary: "Télédéclaration, télépaiement et attestations de paiement pour les entreprises adhérentes.",
    mode: "online",
    url: "https://e-impots.gouv.ci",
    urlLabel: "Portail e-impôts",
    organisme: "Direction générale des impôts (DGI)",
    links: [{ l: "Guide d'adhésion (PDF)", u: "https://www.e-impots.gouv.ci/guide/adhesion-e-impots.pdf" }],
    source: "https://www.e-impots.gouv.ci/guide/presentation-portail.pdf",
    checked: CHECKED,
  },
];

export const demarcheById = new Map(demarches.map((d) => [d.id, d]));

/** Official portals that list every procedure. */
export const PORTALS = [
  { l: "servicepublic.gouv.ci", d: "Le portail de l'Administration : toutes les démarches, par thème", u: "https://www.servicepublic.gouv.ci/" },
  { l: "e-justice.ci", d: "Certificat de nationalité, casier judiciaire, authentification", u: "https://e-justice.ci/" },
  { l: "oneci.ci", d: "Identité, état civil, carte de résident", u: "https://www.oneci.ci/accueil" },
  { l: "documents.ci", d: "Actes d'état civil, légalisation et certification par La Poste", u: "https://documents.ci/" },
];

/** What is done at the town hall (mairie): shown with the viewer's commune. */
export const AT_THE_MAIRIE = ["acte-naissance", "declarer-naissance", "declarer-deces", "mariage", "legalisation", "attestation-domicile"];

export const MODE_LABEL = {
  online: { fr: "En ligne", en: "Online" },
  partial: { fr: "En ligne + guichet", en: "Online + in person" },
  office: { fr: "Au guichet", en: "In person" },
} as const;
