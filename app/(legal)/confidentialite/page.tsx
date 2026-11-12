import type { Metadata } from "next";
import { getLang } from "@/lib/lang";
import { DocPage, type Doc } from "../doc";

export const metadata: Metadata = { title: "Confidentialité", description: "Quelles données POLITIQUE collecte, pourquoi, et pourquoi votre lieu de vote reste privé." };

const fr: Doc = {
  title: "Politique de confidentialité",
  updated: "Version du 12 novembre 2026",
  intro: "Cette page explique quelles données POLITIQUE collecte, à quoi elles servent et qui peut les voir. Le point le plus important : votre lieu de vote est privé.",
  sections: [
    {
      h: "1. Votre lieu de vote est privé",
      p: ["À l'inscription, vous indiquez la région, le département et la commune où vous votez, et si vous le souhaitez votre quartier ou village. Cette information sert à deux choses : vous montrer les élus dont le mandat couvre cet endroit, et compter des résultats par commune sans identifier personne."],
      ul: [
        "Elle n'apparaît ni sur votre profil, ni dans vos posts, ni dans les résultats de recherche.",
        "Aucun autre utilisateur ne peut la consulter, y compris les élus et les modérateurs.",
        "Un élu ne voit jamais la liste de ses électeurs. Il voit seulement des totaux arrondis, et seulement au-delà d'un seuil : 50 personnes pour le nombre d'électeurs inscrits sur POLITIQUE, 50 votes par commune pour le baromètre, 20 soutiens pour la part d'électeurs d'une interpellation.",
        "Vous pouvez la modifier à tout moment dans les paramètres.",
      ],
    },
    { h: "2. Ce qui est public", p: ["Votre nom affiché, votre identifiant, votre bio, votre photo, vos posts, vos réponses, vos reposts et la liste de vos abonnements sont publics. La commune affichée sur votre profil est facultative et sans lien avec votre lieu de vote."] },
    { h: "3. Ce qui est réservé à vous", p: ["Votre adresse email, votre lieu de vote, vos signets, vos votes aux sondages et au baromètre, vos soutiens aux interpellations, vos messages privés (visibles par vous et votre correspondant) et vos notifications."] },
    { h: "4. Vérification des comptes", p: ["Pour obtenir un badge, un élu, une institution ou un média transmet une pièce d'identité et un justificatif de fonction. Ces documents sont stockés dans un espace privé, consultables uniquement par l'équipe de vérification, et ne sont jamais publiés."] },
    { h: "5. Données techniques", p: ["Nous utilisons des cookies strictement nécessaires : votre session, votre langue et votre thème. Nous comptons les vues des posts de façon agrégée. Nous n'utilisons pas de cookies publicitaires et nous ne vendons aucune donnée."] },
    { h: "6. Où sont les données", p: ["Les données sont hébergées chez nos prestataires techniques : Supabase pour la base de données et les fichiers, Vercel pour le site, Resend pour les emails. Ils agissent pour notre compte et selon nos instructions."] },
    { h: "7. Vos droits", p: ["Conformément à la loi ivoirienne n° 2013-450 du 19 juin 2013 relative à la protection des données à caractère personnel, vous pouvez accéder à vos données, les corriger, vous opposer à leur traitement et les faire supprimer. La suppression du compte, depuis les paramètres, efface vos posts, vos messages et vos données privées de façon définitive. L'autorité de contrôle est l'ARTCI."] },
    { h: "8. Mineurs", p: ["POLITIQUE s'adresse aux personnes en âge de voter. Les comptes de personnes de moins de 18 ans ne sont pas autorisés."] },
    { h: "9. Changements", p: ["Si cette politique change sur un point important, en particulier la confidentialité du lieu de vote, vous serez prévenu avant l'entrée en vigueur et vous pourrez refuser."] },
  ],
};

const en: Doc = {
  title: "Privacy policy",
  updated: "Version of 12 November 2026",
  intro: "This page explains what data POLITIQUE collects, what it is used for and who can see it. The most important point: your voting place is private.",
  sections: [
    {
      h: "1. Your voting place is private",
      p: ["At sign-up you give the region, department and commune where you vote, and optionally your neighbourhood or village. This is used for two things: showing you the officials whose mandate covers that place, and counting results per commune without identifying anyone."],
      ul: [
        "It never appears on your profile, in your posts or in search results.",
        "No other user can look it up, including officials and moderators.",
        "An official never sees the list of their voters. They only see rounded totals, and only above a threshold: 50 people for the number of voters registered on POLITIQUE, 50 votes per commune for the barometer, 20 supporters for the share of constituents on a public question.",
        "You can change it at any time in Settings.",
      ],
    },
    { h: "2. What is public", p: ["Your display name, handle, bio, photo, posts, replies, reposts and the list of accounts you follow are public. The commune shown on your profile is optional and unrelated to your voting place."] },
    { h: "3. What only you can see", p: ["Your email address, your voting place, your bookmarks, your poll and barometer votes, the public questions you support, your direct messages (visible to you and the other person) and your notifications."] },
    { h: "4. Account verification", p: ["To get a badge, an official, institution or media outlet sends an ID and proof of office. These documents are stored in a private space, viewable only by the verification team, and are never published."] },
    { h: "5. Technical data", p: ["We use strictly necessary cookies: your session, your language and your theme. We count post views in aggregate. We do not use advertising cookies and we do not sell data."] },
    { h: "6. Where the data lives", p: ["Data is hosted by our technical providers: Supabase for the database and files, Vercel for the site, Resend for email. They act on our behalf and under our instructions."] },
    { h: "7. Your rights", p: ["Under Ivorian law no. 2013-450 of 19 June 2013 on the protection of personal data, you can access your data, correct it, object to its processing and have it deleted. Deleting your account, from Settings, permanently erases your posts, messages and private data. The supervisory authority is ARTCI."] },
    { h: "8. Minors", p: ["POLITIQUE is for people of voting age. Accounts for people under 18 are not allowed."] },
    { h: "9. Changes", p: ["If this policy changes on an important point, in particular the privacy of the voting place, you will be told before it takes effect and you will be able to refuse."] },
  ],
};

export default async function PrivacyPage() {
  const lang = await getLang();
  return <DocPage doc={lang === "fr" ? fr : en} lang={lang} />;
}
