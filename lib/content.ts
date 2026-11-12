export type Lang = "fr" | "en";

export const site = {
  name: "POLITIQUE",
  origin: process.env.SITE_URL || "https://politique.prototypex.org",
  parent: { name: "Prototype X", url: "https://prototypex.org" },
  /** Public contact address for privacy and moderation requests. Falls back to the parent site. */
  contact: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
};

type Feature = { title: string; body: string; icon: IconName };
export type IconName =
  | "feed"
  | "badge"
  | "poll"
  | "video"
  | "map"
  | "shield"
  | "chat"
  | "chart";

export type Content = {
  htmlLang: string;
  meta: { title: string; description: string };
  nav: { features: string; who: string; roadmap: string; faq: string; cta: string; switchLabel: string; switchHref: string };
  hero: {
    eyebrow: string;
    title: string;
    titleAccent: string;
    body: string;
    primary: string;
    secondary: string;
    note: string;
  };
  mock: {
    tabs: [string, string];
    mp: { name: string; handle: string; role: string; time: string; text: string; likes: string; replies: string; reposts: string };
    poll: { name: string; handle: string; role: string; time: string; question: string; options: { label: string; pct: number }[]; votes: string };
    video: { name: string; handle: string; role: string; time: string; text: string; duration: string; caption: string };
    verified: string;
  };
  who: { title: string; body: string; groups: { tag: string; title: string; points: string[] }[] };
  features: { title: string; body: string; items: Feature[] };
  roadmap: { title: string; body: string; steps: { when: string; title: string; body: string; state: "done" | "now" | "next" }[] };
  faq: { title: string; items: { q: string; a: string }[] };
  cta: { title: string; body: string };
  form: {
    email: string;
    emailPlaceholder: string;
    role: string;
    roles: { value: string; label: string }[];
    submit: string;
    sending: string;
    success: string;
    error: string;
    consent: string;
  };
  footer: { madeBy: string; rights: string; privacy: string; contact: string };
};

const fr: Content = {
  htmlLang: "fr",
  meta: {
    title: "POLITIQUE — Le réseau social politique de la Côte d'Ivoire",
    description:
      "POLITIQUE met les citoyens et leurs élus sur la même place publique : posts, sondages, débats vidéo et comptes vérifiés. Inscrivez-vous pour la bêta.",
  },
  nav: {
    features: "Fonctions",
    who: "Pour qui",
    roadmap: "Calendrier",
    faq: "Questions",
    cta: "Rejoindre la bêta",
    switchLabel: "English",
    switchHref: "/en",
  },
  hero: {
    eyebrow: "Bientôt en Côte d'Ivoire",
    title: "La parole des citoyens,",
    titleAccent: "en face de leurs élus.",
    body:
      "POLITIQUE est un réseau social dédié à la vie politique ivoirienne. Un fil public où les citoyens, les élus, les institutions et les médias se parlent directement, avec des comptes vérifiés et des règles claires.",
    primary: "Rejoindre la liste d'attente",
    secondary: "Voir les fonctions",
    note: "Gratuit. Français et anglais. Web et Android d'abord, iOS ensuite.",
  },
  mock: {
    tabs: ["Pour vous", "Abonnements"],
    verified: "Compte vérifié",
    mp: {
      name: "Awa Koné",
      handle: "@awakone",
      role: "Députée · Cocody",
      time: "2 h",
      text: "Ce matin en commission : le budget 2027 des routes communales est passé. Je publie le détail par quartier cet après-midi. Vos questions ici, j'y réponds ce soir.",
      likes: "1 240",
      replies: "312",
      reposts: "208",
    },
    poll: {
      name: "Yao Kouadio",
      handle: "@yaok",
      role: "Citoyen · Yopougon",
      time: "5 h",
      question: "Priorité n°1 pour la commune en 2027 ?",
      options: [
        { label: "Routes et drainage", pct: 46 },
        { label: "Écoles", pct: 28 },
        { label: "Santé", pct: 18 },
        { label: "Sécurité", pct: 8 },
      ],
      votes: "4 812 votes · 2 jours restants",
    },
    video: {
      name: "Fraternité Matin",
      handle: "@fratmat",
      role: "Média",
      time: "Hier",
      text: "Débat : la décentralisation, dix ans après. Avec trois maires et un économiste.",
      duration: "28:14",
      caption: "Sous-titres FR",
    },
  },
  who: {
    title: "Une place publique pour tout le monde",
    body: "POLITIQUE est pensé pour trois publics qui, aujourd'hui, se parlent peu et mal.",
    groups: [
      {
        tag: "Citoyens",
        title: "Suivre, questionner, voter",
        points: [
          "Retrouvez les élus de votre commune et suivez ce qu'ils font.",
          "Posez une question publique, obtenez une réponse publique.",
          "Votez dans des sondages ouverts et voyez les résultats en direct.",
        ],
      },
      {
        tag: "Élus et institutions",
        title: "Parler directement, sans filtre",
        points: [
          "Un compte vérifié avec votre fonction et votre circonscription.",
          "Des séances de questions-réponses programmées avec vos administrés.",
          "Des statistiques claires sur ce qui est lu, partagé et débattu.",
        ],
      },
      {
        tag: "Médias",
        title: "Informer là où le débat se tient",
        points: [
          "Des comptes média identifiés, avec aperçu des articles.",
          "Des vidéos longues, jusqu'à 30 minutes, avec sous-titres.",
          "Des tendances par ville pour suivre ce qui monte.",
        ],
      },
    ],
  },
  features: {
    title: "Tout ce qu'un réseau social fait, adapté à la Côte d'Ivoire",
    body: "Posts, réponses, reposts, messages privés, sondages et vidéos. Plus ce qui manque ailleurs : la vérification des élus et une modération en français.",
    items: [
      { icon: "feed", title: "Deux fils, un choix", body: "« Pour vous » classe par pertinence. « Abonnements » reste chronologique. Vous décidez." },
      { icon: "badge", title: "Élus vérifiés", body: "Députés, maires, ministères et médias passent une vérification d'identité avant d'obtenir leur badge." },
      { icon: "poll", title: "Sondages", body: "Jusqu'à quatre choix, un vote par personne, résultats publics." },
      { icon: "video", title: "Vidéos jusqu'à 30 min", body: "Débats, conseils municipaux, interviews. Avec sous-titres et lecture adaptée aux connexions mobiles." },
      { icon: "map", title: "Explorer par ville", body: "Tendances et élus filtrés par commune : Abidjan, Bouaké, Yamoussoukro, Korhogo, San-Pédro et les autres." },
      { icon: "shield", title: "Modération claire", body: "Signalement en un geste, règles publiées en français, revue humaine pour chaque sanction." },
      { icon: "chat", title: "Messages privés", body: "Conversations à deux ou en groupe, avec blocage et sourdine." },
      { icon: "chart", title: "Statistiques utiles", body: "Chaque compte voit sa portée. Les comptes vérifiés en voient davantage." },
    ],
  },
  roadmap: {
    title: "Où en est-on",
    body: "Le projet a démarré en novembre 2026. Les dates ci-dessous sont des objectifs, pas des promesses.",
    steps: [
      { when: "Novembre 2026", title: "Conception et mise en place", body: "Spécification, choix techniques, ce site et la liste d'attente.", state: "now" },
      { when: "Début 2027", title: "Bêta fermée", body: "Web et Android, sur invitation. Les premiers inscrits sur cette page entrent en premier.", state: "next" },
      { when: "Premier trimestre 2027", title: "Lancement public", body: "Vidéos longues, messages privés, application iOS.", state: "next" },
      { when: "Ensuite", title: "Au-delà de la Côte d'Ivoire", body: "D'autres pays d'Afrique francophone, puis anglophone.", state: "next" },
    ],
  },
  faq: {
    title: "Questions fréquentes",
    items: [
      { q: "Est-ce gratuit ?", a: "Oui. L'inscription et l'utilisation sont gratuites. Des options payantes pour les organisations viendront plus tard, toujours signalées clairement." },
      { q: "Qui vérifie les élus ?", a: "Une équipe humaine, sur présentation d'une pièce d'identité et d'un justificatif de fonction. Le badge indique la fonction et la circonscription." },
      { q: "Dans quelles langues ?", a: "Français d'abord, anglais ensuite. D'autres langues suivront avec l'ouverture à d'autres pays." },
      { q: "Et mes données ?", a: "Elles sont hébergées en Europe, chiffrées, et ne sont jamais vendues. Vous pouvez supprimer votre compte à tout moment." },
      { q: "Puis-je m'inscrire si je ne suis pas en Côte d'Ivoire ?", a: "Oui. La diaspora est la bienvenue dès la bêta." },
    ],
  },
  cta: {
    title: "Entrez dans la bêta en premier",
    body: "Laissez votre email. Nous écrivons seulement pour les invitations et les grandes étapes, jamais plus d'une fois par mois.",
  },
  form: {
    email: "Adresse email",
    emailPlaceholder: "vous@exemple.ci",
    role: "Vous êtes",
    roles: [
      { value: "citoyen", label: "Citoyen·ne" },
      { value: "elu", label: "Élu·e ou institution" },
      { value: "media", label: "Média ou journaliste" },
      { value: "autre", label: "Autre" },
    ],
    submit: "M'inscrire",
    sending: "Envoi…",
    success: "C'est noté. Nous vous écrirons pour la bêta.",
    error: "Ça n'a pas marché. Réessayez dans un instant.",
    consent: "En vous inscrivant, vous acceptez de recevoir des emails sur POLITIQUE. Désinscription en un clic.",
  },
  footer: {
    madeBy: "Un projet de",
    rights: "Tous droits réservés.",
    privacy: "Confidentialité",
    contact: "Contact",
  },
};

const en: Content = {
  htmlLang: "en",
  meta: {
    title: "POLITIQUE — Côte d'Ivoire's political social network",
    description:
      "POLITIQUE puts citizens and their elected officials on the same public square: posts, polls, video debates and verified accounts. Sign up for the beta.",
  },
  nav: {
    features: "Features",
    who: "Who it's for",
    roadmap: "Timeline",
    faq: "FAQ",
    cta: "Join the beta",
    switchLabel: "Français",
    switchHref: "/",
  },
  hero: {
    eyebrow: "Coming soon in Côte d'Ivoire",
    title: "Citizens' voices,",
    titleAccent: "face to face with their representatives.",
    body:
      "POLITIQUE is a social network built for Ivorian political life. One public feed where citizens, elected officials, institutions and the press talk to each other directly, with verified accounts and clear rules.",
    primary: "Join the waitlist",
    secondary: "See the features",
    note: "Free. French and English. Web and Android first, iOS next.",
  },
  mock: {
    tabs: ["For you", "Following"],
    verified: "Verified account",
    mp: {
      name: "Awa Koné",
      handle: "@awakone",
      role: "MP · Cocody",
      time: "2h",
      text: "In committee this morning: the 2027 budget for local roads passed. I'll post the breakdown by neighbourhood this afternoon. Ask your questions here, I'll answer tonight.",
      likes: "1,240",
      replies: "312",
      reposts: "208",
    },
    poll: {
      name: "Yao Kouadio",
      handle: "@yaok",
      role: "Citizen · Yopougon",
      time: "5h",
      question: "Top priority for the commune in 2027?",
      options: [
        { label: "Roads and drainage", pct: 46 },
        { label: "Schools", pct: 28 },
        { label: "Health", pct: 18 },
        { label: "Safety", pct: 8 },
      ],
      votes: "4,812 votes · 2 days left",
    },
    video: {
      name: "Fraternité Matin",
      handle: "@fratmat",
      role: "Media",
      time: "Yesterday",
      text: "Debate: decentralisation, ten years on. With three mayors and an economist.",
      duration: "28:14",
      caption: "FR subtitles",
    },
  },
  who: {
    title: "A public square for everyone",
    body: "POLITIQUE is designed for three groups that, today, rarely talk to each other, and rarely well.",
    groups: [
      {
        tag: "Citizens",
        title: "Follow, ask, vote",
        points: [
          "Find the officials for your commune and follow what they do.",
          "Ask a public question, get a public answer.",
          "Vote in open polls and watch the results live.",
        ],
      },
      {
        tag: "Officials and institutions",
        title: "Speak directly, unfiltered",
        points: [
          "A verified account showing your office and constituency.",
          "Scheduled Q&A sessions with the people you represent.",
          "Clear numbers on what gets read, shared and debated.",
        ],
      },
      {
        tag: "Media",
        title: "Report where the debate happens",
        points: [
          "Identified media accounts, with article previews.",
          "Long videos, up to 30 minutes, with subtitles.",
          "City-level trends to see what is rising.",
        ],
      },
    ],
  },
  features: {
    title: "Everything a social network does, built for Côte d'Ivoire",
    body: "Posts, replies, reposts, direct messages, polls and video. Plus what is missing elsewhere: verification of elected officials and moderation in French.",
    items: [
      { icon: "feed", title: "Two feeds, your choice", body: "“For you” ranks by relevance. “Following” stays chronological. You decide." },
      { icon: "badge", title: "Verified officials", body: "MPs, mayors, ministries and media outlets pass an identity check before they get their badge." },
      { icon: "poll", title: "Polls", body: "Up to four options, one vote per person, public results." },
      { icon: "video", title: "Video up to 30 min", body: "Debates, council meetings, interviews. With subtitles and playback tuned for mobile connections." },
      { icon: "map", title: "Explore by city", body: "Trends and officials filtered by commune: Abidjan, Bouaké, Yamoussoukro, Korhogo, San-Pédro and more." },
      { icon: "shield", title: "Clear moderation", body: "One-tap reporting, rules published in French, a human review for every sanction." },
      { icon: "chat", title: "Direct messages", body: "One-to-one or group conversations, with block and mute." },
      { icon: "chart", title: "Useful stats", body: "Every account sees its reach. Verified accounts see more." },
    ],
  },
  roadmap: {
    title: "Where we are",
    body: "The project started in November 2026. The dates below are targets, not promises.",
    steps: [
      { when: "November 2026", title: "Design and setup", body: "Specification, technical choices, this site and the waitlist.", state: "now" },
      { when: "Early 2027", title: "Closed beta", body: "Web and Android, by invitation. The first people on this list get in first.", state: "next" },
      { when: "Q1 2027", title: "Public launch", body: "Long videos, direct messages, iOS app.", state: "next" },
      { when: "After that", title: "Beyond Côte d'Ivoire", body: "Other French-speaking African countries, then English-speaking ones.", state: "next" },
    ],
  },
  faq: {
    title: "Frequently asked questions",
    items: [
      { q: "Is it free?", a: "Yes. Signing up and using POLITIQUE is free. Paid options for organisations will come later, always clearly labelled." },
      { q: "Who verifies officials?", a: "A human team, on presentation of an ID and proof of office. The badge shows the office and the constituency." },
      { q: "Which languages?", a: "French first, English next. Other languages will follow as we open to other countries." },
      { q: "What about my data?", a: "It is hosted in Europe, encrypted, and never sold. You can delete your account at any time." },
      { q: "Can I sign up if I'm not in Côte d'Ivoire?", a: "Yes. The diaspora is welcome from the beta onwards." },
    ],
  },
  cta: {
    title: "Get into the beta first",
    body: "Leave your email. We only write for invitations and major milestones, never more than once a month.",
  },
  form: {
    email: "Email address",
    emailPlaceholder: "you@example.com",
    role: "You are",
    roles: [
      { value: "citoyen", label: "A citizen" },
      { value: "elu", label: "An official or institution" },
      { value: "media", label: "Media or journalist" },
      { value: "autre", label: "Other" },
    ],
    submit: "Sign me up",
    sending: "Sending…",
    success: "Noted. We'll write to you about the beta.",
    error: "That didn't work. Try again in a moment.",
    consent: "By signing up you agree to receive emails about POLITIQUE. Unsubscribe in one click.",
  },
  footer: {
    madeBy: "A project by",
    rights: "All rights reserved.",
    privacy: "Privacy",
    contact: "Contact",
  },
};

export const content: Record<Lang, Content> = { fr, en };
