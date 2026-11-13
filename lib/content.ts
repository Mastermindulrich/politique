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
  nav: { features: string; who: string; how: string; faq: string; login: string; signup: string; switchLabel: string; switchHref: string };
  hero: { eyebrow: string; title: string; titleAccent: string; body: string; primary: string; secondary: string; note: string };
  mock: {
    tabs: [string, string];
    mp: { name: string; handle: string; role: string; time: string; text: string; likes: string; replies: string; reposts: string };
    poll: { name: string; handle: string; role: string; time: string; question: string; options: { label: string; pct: number }[]; votes: string };
    video: { name: string; handle: string; role: string; time: string; text: string; duration: string; caption: string };
    verified: string;
  };
  who: { title: string; body: string; groups: { tag: string; title: string; points: string[] }[] };
  features: { title: string; body: string; items: Feature[] };
  how: { title: string; body: string; steps: { title: string; body: string }[] };
  faq: { title: string; items: { q: string; a: string }[] };
  cta: { title: string; body: string; button: string; login: string };
  footer: { madeBy: string; rights: string; rules: string; privacy: string; directory: string };
};

const fr: Content = {
  htmlLang: "fr",
  meta: {
    title: "POLITIQUE — Le réseau social politique de la Côte d'Ivoire",
    description:
      "Sur POLITIQUE, les citoyens interpellent leurs élus, suivent leurs promesses et débattent à visage découvert. Le réseau social de la vie politique ivoirienne.",
  },
  nav: { features: "Fonctionnalités", who: "Pour qui", how: "Comment ça marche", faq: "Questions", login: "Se connecter", signup: "Créer un compte", switchLabel: "English", switchHref: "/en" },
  hero: {
    eyebrow: "Le réseau social de la vie politique ivoirienne",
    title: "Vos élus vous doivent",
    titleAccent: "des réponses.",
    body:
      "Sur POLITIQUE, citoyens, élus, institutions et médias se parlent sans intermédiaire. Retrouvez les élus de votre commune, posez-leur vos questions en public et suivez leurs engagements, du conseil municipal à l'Assemblée nationale.",
    primary: "Créer mon compte",
    secondary: "Découvrir",
    note: "Gratuit, en français et en anglais. Votre lieu de vote reste privé.",
  },
  mock: {
    tabs: ["Pour vous", "Abonnements"],
    verified: "Compte vérifié",
    mp: {
      name: "Awa Koné",
      handle: "@awakone",
      role: "Députée · Cocody",
      time: "2 h",
      text: "Le budget 2027 des routes communales est passé ce matin en commission. Je publie le détail quartier par quartier cet après-midi. Posez vos questions en réponse, je vous lis ce soir.",
      likes: "1 240",
      replies: "312",
      reposts: "208",
    },
    poll: {
      name: "Yao Kouadio",
      handle: "@yaok",
      role: "Citoyen · Yopougon",
      time: "5 h",
      question: "Quelle doit être la priorité de la commune en 2027 ?",
      options: [
        { label: "Routes et caniveaux", pct: 46 },
        { label: "Écoles", pct: 28 },
        { label: "Santé", pct: 18 },
        { label: "Sécurité", pct: 8 },
      ],
      votes: "4 812 votes · encore 2 jours",
    },
    video: {
      name: "Lagune Infos",
      handle: "@laguneinfos",
      role: "Média",
      time: "Hier",
      text: "Débat : où en est la décentralisation ? Trois maires et un économiste face à vos questions.",
      duration: "4:58",
      caption: "Extrait",
    },
  },
  who: {
    title: "Une place publique pour tous",
    body: "Le débat politique se passe déjà en ligne, mais éparpillé et sans règles. POLITIQUE le rassemble en un seul lieu, où chacun sait à qui il parle.",
    groups: [
      {
        tag: "Citoyens",
        title: "Suivre, interpeller, peser",
        points: [
          "Retrouvez automatiquement les élus de l'endroit où vous votez.",
          "Posez une question publique : plus elle est soutenue, plus la réponse est attendue.",
          "Votez au baromètre du mois et proposez des idées pour votre commune.",
        ],
      },
      {
        tag: "Élus et institutions",
        title: "Parler directement à ses administrés",
        points: [
          "Un compte vérifié qui affiche votre mandat et votre circonscription.",
          "Des permanences en ligne pour répondre en direct, devant tout le monde.",
          "Le nombre de vos électeurs présents sur POLITIQUE, sans jamais savoir qui ils sont.",
        ],
      },
      {
        tag: "Médias",
        title: "Informer là où le débat se tient",
        points: [
          "Un compte média identifié par un badge.",
          "La possibilité d'ajouter du contexte à une publication trompeuse.",
          "Les tendances commune par commune, pour voir ce qui monte.",
        ],
      },
    ],
  },
  features: {
    title: "Un vrai réseau social, pensé pour la Côte d'Ivoire",
    body: "Publications, réponses, republications, messages privés et sondages, comme ailleurs. Et en plus, des outils faits pour demander des comptes.",
    items: [
      { icon: "map", title: "Mes élus", body: "Maire, député, conseil régional : POLITIQUE vous montre qui vous représente, à partir de l'endroit où vous votez." },
      { icon: "chat", title: "Interpellations", body: "Une question publique adressée à un élu. Les citoyens la soutiennent, l'élu y répond devant tous." },
      { icon: "badge", title: "Promesses suivies", body: "Chaque engagement est daté et sourcé : annoncé, en cours, tenu ou non tenu." },
      { icon: "chart", title: "Le baromètre", body: "Une question par mois posée à tout le pays, avec des résultats par commune à partir de 50 votes." },
      { icon: "poll", title: "Boîte à idées", body: "Proposez une idée concrète pour votre commune. Les plus soutenues sont transmises à vos élus." },
      { icon: "video", title: "Permanences en ligne", body: "L'élu ouvre un créneau et répond en direct aux questions de ses administrés." },
      { icon: "feed", title: "Deux fils", body: "« Pour vous » met en avant ce qui compte autour de vous. « Abonnements » reste chronologique." },
      { icon: "shield", title: "Modération humaine", body: "Règles publiées, signalement en un geste et décisions prises par des personnes, jamais par un robot seul." },
    ],
  },
  how: {
    title: "Comment ça marche",
    body: "Trois minutes suffisent pour créer votre compte.",
    steps: [
      { title: "Créez votre compte", body: "Une adresse e-mail suffit : vous recevez un code, pas de mot de passe à retenir." },
      { title: "Indiquez où vous votez", body: "Région, département, commune. Cette information reste privée : elle sert seulement à vous relier à vos élus." },
      { title: "Prenez la parole", body: "Abonnez-vous à vos élus, interpellez-les, votez au baromètre et débattez avec vos concitoyens." },
    ],
  },
  faq: {
    title: "Questions fréquentes",
    items: [
      { q: "Est-ce gratuit ?", a: "Oui, l'inscription et l'utilisation sont gratuites." },
      { q: "Mon lieu de vote est-il visible ?", a: "Non. Il n'apparaît ni sur votre profil ni auprès des élus. Ceux-ci ne voient que des totaux, et seulement au-delà de 50 personnes." },
      { q: "Comment un élu obtient-il son badge ?", a: "Il transmet une pièce d'identité et un justificatif de fonction. Un membre de l'équipe les vérifie avant d'accorder le badge." },
      { q: "Qui modère les échanges ?", a: "Une équipe humaine, selon des règles publiques. Chaque publication, profil ou message peut être signalé." },
      { q: "Puis-je m'inscrire depuis l'étranger ?", a: "Oui. La diaspora est la bienvenue : indiquez simplement l'endroit où vous êtes inscrit sur les listes électorales." },
    ],
  },
  cta: {
    title: "Votre voix compte. Faites-la entendre.",
    body: "Rejoignez les citoyens et les élus qui débattent déjà sur POLITIQUE.",
    button: "Créer mon compte",
    login: "J'ai déjà un compte",
  },
  footer: { madeBy: "Un projet", rights: "Tous droits réservés.", rules: "Règles de la communauté", privacy: "Confidentialité", directory: "Annuaire des élus" },
};

const en: Content = {
  htmlLang: "en",
  meta: {
    title: "POLITIQUE — Côte d'Ivoire's political social network",
    description:
      "On POLITIQUE, citizens question their elected officials in public, track their promises and debate openly. The social network for Ivorian political life.",
  },
  nav: { features: "Features", who: "Who it's for", how: "How it works", faq: "FAQ", login: "Log in", signup: "Create account", switchLabel: "Français", switchHref: "/" },
  hero: {
    eyebrow: "The social network for Ivorian political life",
    title: "Your representatives",
    titleAccent: "owe you answers.",
    body:
      "On POLITIQUE, citizens, elected officials, institutions and the press talk to each other directly. Find the officials for your commune, ask them questions in public and follow their commitments, from the town council to the National Assembly.",
    primary: "Create my account",
    secondary: "Learn more",
    note: "Free, in French and English. Where you vote stays private.",
  },
  mock: {
    tabs: ["For you", "Following"],
    verified: "Verified account",
    mp: {
      name: "Awa Koné",
      handle: "@awakone",
      role: "MP · Cocody",
      time: "2h",
      text: "The 2027 budget for communal roads passed in committee this morning. I'll publish the breakdown by neighbourhood this afternoon. Reply with your questions and I'll read them tonight.",
      likes: "1,240",
      replies: "312",
      reposts: "208",
    },
    poll: {
      name: "Yao Kouadio",
      handle: "@yaok",
      role: "Citizen · Yopougon",
      time: "5h",
      question: "What should the commune's top priority be in 2027?",
      options: [
        { label: "Roads and drainage", pct: 46 },
        { label: "Schools", pct: 28 },
        { label: "Health", pct: 18 },
        { label: "Security", pct: 8 },
      ],
      votes: "4,812 votes · 2 days left",
    },
    video: {
      name: "Lagune Infos",
      handle: "@laguneinfos",
      role: "Media",
      time: "Yesterday",
      text: "Debate: where does decentralisation stand? Three mayors and an economist take your questions.",
      duration: "4:58",
      caption: "Clip",
    },
  },
  who: {
    title: "A public square for everyone",
    body: "Political debate already happens online, but it is scattered and has no rules. POLITIQUE brings it to one place, where everyone knows who they are talking to.",
    groups: [
      {
        tag: "Citizens",
        title: "Follow, question, weigh in",
        points: [
          "Automatically find the officials for the place where you vote.",
          "Ask a public question: the more support it gets, the more an answer is expected.",
          "Vote in the monthly barometer and propose ideas for your commune.",
        ],
      },
      {
        tag: "Officials and institutions",
        title: "Talk directly to constituents",
        points: [
          "A verified account showing your mandate and constituency.",
          "Live sessions to answer questions in real time, in public.",
          "How many of your constituents are on POLITIQUE, without ever knowing who they are.",
        ],
      },
      {
        tag: "Media",
        title: "Report where the debate happens",
        points: [
          "A media account identified by a badge.",
          "The ability to add context to a misleading post.",
          "Trends commune by commune, to see what is rising.",
        ],
      },
    ],
  },
  features: {
    title: "A real social network, built for Côte d'Ivoire",
    body: "Posts, replies, reposts, direct messages and polls, like elsewhere. Plus tools made for holding power to account.",
    items: [
      { icon: "map", title: "My officials", body: "Mayor, MP, regional council: POLITIQUE shows who represents you, based on where you vote." },
      { icon: "chat", title: "Public questions", body: "A question addressed to an official. Citizens back it, and the official answers in front of everyone." },
      { icon: "badge", title: "Tracked promises", body: "Every commitment is dated and sourced: announced, in progress, kept or not kept." },
      { icon: "chart", title: "The barometer", body: "One question a month for the whole country, with results per commune from 50 votes." },
      { icon: "poll", title: "Idea box", body: "Propose a concrete idea for your commune. The most supported are passed on to your officials." },
      { icon: "video", title: "Live sessions", body: "An official opens a slot and answers constituents' questions live." },
      { icon: "feed", title: "Two feeds", body: "\"For you\" highlights what matters around you. \"Following\" stays chronological." },
      { icon: "shield", title: "Human moderation", body: "Published rules, one-tap reporting and decisions made by people, never by a bot alone." },
    ],
  },
  how: {
    title: "How it works",
    body: "Creating your account takes three minutes.",
    steps: [
      { title: "Create your account", body: "All you need is an email address: you get a code, no password to remember." },
      { title: "Say where you vote", body: "Region, department, commune. This stays private: it only links you to your officials." },
      { title: "Speak up", body: "Follow your officials, question them, vote in the barometer and debate with fellow citizens." },
    ],
  },
  faq: {
    title: "Frequently asked questions",
    items: [
      { q: "Is it free?", a: "Yes, signing up and using POLITIQUE are free." },
      { q: "Is my voting place visible?", a: "No. It never appears on your profile or to officials. They only see totals, and only above 50 people." },
      { q: "How does an official get a badge?", a: "They send an ID and proof of office. A team member checks them before granting the badge." },
      { q: "Who moderates?", a: "A human team, following public rules. Any post, profile or message can be reported." },
      { q: "Can I sign up from abroad?", a: "Yes. The diaspora is welcome: just give the place where you are on the electoral roll." },
    ],
  },
  cta: {
    title: "Your voice counts. Make it heard.",
    body: "Join the citizens and officials already debating on POLITIQUE.",
    button: "Create my account",
    login: "I already have an account",
  },
  footer: { madeBy: "A project by", rights: "All rights reserved.", rules: "Community rules", privacy: "Privacy", directory: "Officials directory" },
};

export const content: Record<Lang, Content> = { fr, en };
