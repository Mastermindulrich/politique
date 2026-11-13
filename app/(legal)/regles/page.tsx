import type { Metadata } from "next";
import { getLang } from "@/lib/lang";
import { DocPage, type Doc } from "../doc";

export const metadata: Metadata = { title: "Règles de la communauté", description: "Les règles du débat sur POLITIQUE : respect, faits, pas de haine ni d'usurpation." };

const fr: Doc = {
  title: "Règles de la communauté",
  updated: "Version du 12 novembre 2026",
  intro: "POLITIQUE existe pour rapprocher les citoyens et celles et ceux qui les représentent. On peut tout y contester : une décision, un bilan, une promesse. On n'y attaque pas les personnes pour ce qu'elles sont.",
  sections: [
    { h: "1. On débat des idées et des actes", p: ["La critique d'un élu, d'un parti ou d'une institution est libre, y compris quand elle est dure. Elle porte sur des actes, des votes, des déclarations, des résultats."] },
    {
      h: "2. Ce qui est interdit",
      ul: [
        "Les propos haineux, tribalistes, xénophobes ou religieux visant une personne ou un groupe pour son origine, son ethnie, sa région, sa nationalité, sa religion, son sexe ou son handicap.",
        "Les appels à la violence, les menaces et l'intimidation, contre qui que ce soit.",
        "Le harcèlement : s'acharner sur une personne, publier son adresse, son numéro ou des informations privées.",
        "L'usurpation d'identité. Les comptes parodiques sont permis s'ils l'indiquent clairement dans leur nom et leur bio.",
        "La désinformation électorale : faux résultats, fausses dates ou faux lieux de vote, fausses consignes de la CEI.",
        "L'achat de voix, la vente de cartes d'électeur et toute sollicitation d'argent en échange d'un vote.",
        "Le spam, les faux comptes et les campagnes coordonnées pour gonfler artificiellement un sujet.",
        "Les contenus à caractère sexuel et les images de violence gratuite.",
      ],
    },
    { h: "3. Les comptes vérifiés", p: ["Un badge vert identifie une élue ou un élu, un badge gris une institution, un badge orange un média. Le badge est accordé après vérification d'une pièce d'identité et d'un justificatif de fonction. Il atteste l'identité, pas la justesse de ce qui est publié.", "Les élus s'engagent à répondre eux-mêmes ou par leur équipe déclarée, et à ne pas supprimer une réponse officielle à une interpellation."] },
    { h: "4. Interpellations, promesses et permanences", p: ["Une interpellation est une question publique et précise adressée à un élu. Une promesse suivie doit s'appuyer sur une source : discours, programme, article de presse. Les mises à jour d'une promesse citent elles aussi leur source."] },
    { h: "5. Contexte et vérification des faits", p: ["Les modérateurs et les médias vérifiés peuvent ajouter une étiquette à un post : contexte, information contestée, information fausse, satire, communication officielle. Une étiquette ne supprime pas le post, elle informe le lecteur."] },
    { h: "6. Signalements et sanctions", p: ["Chaque post, profil et message peut être signalé. Une personne de l'équipe examine le signalement. Selon la gravité : le post est masqué, le compte est suspendu sept jours, ou le compte est banni. La personne concernée est prévenue par une notification."] },
    { h: "7. Périodes électorales", p: ["Pendant les campagnes et le jour du vote, la modération est renforcée. Les règles de la Commission électorale indépendante et la loi ivoirienne s'appliquent aux contenus publiés ici comme ailleurs."] },
  ],
};

const en: Doc = {
  title: "Community rules",
  updated: "Version of 12 November 2026",
  intro: "POLITIQUE exists to bring citizens closer to the people who represent them. Everything can be challenged here: a decision, a record, a promise. People are not attacked for who they are.",
  sections: [
    { h: "1. Debate ideas and actions", p: ["Criticism of an official, a party or an institution is free, even when it is harsh. It is about actions, votes, statements and results."] },
    {
      h: "2. What is not allowed",
      ul: [
        "Hateful, tribalist, xenophobic or religious attacks on a person or group because of origin, ethnicity, region, nationality, religion, sex or disability.",
        "Calls for violence, threats and intimidation, against anyone.",
        "Harassment: piling on a person, publishing their address, phone number or private information.",
        "Impersonation. Parody accounts are allowed when the name and bio say so clearly.",
        "Election misinformation: fake results, fake voting dates or places, fake instructions from the electoral commission (CEI).",
        "Vote buying, selling voter cards and any request for money in exchange for a vote.",
        "Spam, fake accounts and coordinated campaigns to inflate a topic.",
        "Sexual content and gratuitous violent imagery.",
      ],
    },
    { h: "3. Verified accounts", p: ["A green badge marks an elected official, a grey badge an institution, an orange badge a media outlet. The badge is granted after checking an ID and proof of office. It certifies identity, not the accuracy of what is posted.", "Officials commit to answering themselves or through their declared team, and to not deleting an official answer to a public question."] },
    { h: "4. Public questions, promises and office hours", p: ["An interpellation is a precise public question to an official. A tracked promise must rely on a source: a speech, a manifesto, a press article. Updates to a promise cite their source too."] },
    { h: "5. Context and fact-checking", p: ["Moderators and verified media can add a label to a post: context, disputed, false, satire, official communication. A label does not remove the post, it informs the reader."] },
    { h: "6. Reports and sanctions", p: ["Every post, profile and message can be reported. A team member reviews the report. Depending on severity: the post is hidden, the account is suspended for seven days, or the account is banned. The person concerned is told by notification."] },
    { h: "7. Election periods", p: ["During campaigns and on polling day, moderation is reinforced. The rules of the Independent Electoral Commission and Ivorian law apply to content published here as anywhere else."] },
  ],
};

export default async function RulesPage() {
  const lang = await getLang();
  return <DocPage doc={lang === "fr" ? fr : en} lang={lang} />;
}
