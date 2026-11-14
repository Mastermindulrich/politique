/**
 * Notification copy and preference categories, shared by the in-app toasts,
 * the Web Push sender and the settings page. No server or browser imports here.
 */
import type { Notification } from "@/lib/types";

export type NotifType = Notification["type"];
export type Lang = "fr" | "en";

export const CATEGORIES = ["messages", "replies", "mentions", "follows", "following_posts", "official_posts", "civic", "likes", "reposts"] as const;
export type Category = (typeof CATEGORIES)[number];

export function categoryOf(t: NotifType): Category | "account" {
  switch (t) {
    case "like": return "likes";
    case "repost": return "reposts";
    case "reply":
    case "quote": return "replies";
    case "mention": return "mentions";
    case "follow": return "follows";
    case "following_post": return "following_posts";
    case "official_post": return "official_posts";
    case "message": return "messages";
    case "interpellation_answer":
    case "poll_end": return "civic";
    default: return "account";
  }
}

/** Must match notif_default() in the database. */
export const defaultPref = (c: Category, push: boolean) => !(push && (c === "likes" || c === "reposts"));

export type Prefs = {
  inapp: Partial<Record<Category, boolean>>;
  push: Partial<Record<Category, boolean>>;
  sound: boolean;
  previews: boolean;
  quiet_start: number | null;
  quiet_end: number | null;
};
export const DEFAULT_PREFS: Prefs = { inapp: {}, push: {}, sound: true, previews: true, quiet_start: null, quiet_end: null };

export const prefOn = (p: Prefs, c: Category, push: boolean) => {
  const inapp = p.inapp[c] ?? defaultPref(c, false);
  if (!push) return inapp;
  return inapp && (p.push[c] ?? defaultPref(c, true));
};

const COPY = {
  fr: {
    like: "a aimé votre publication",
    reply: "a répondu à votre publication",
    repost: "a republié votre publication",
    quote: "a cité votre publication",
    follow: "s'est abonné à vous",
    mention: "vous a mentionné",
    following_post: "a publié",
    official_post: "Votre élu a publié",
    interpellation_answer: "a répondu à une interpellation que vous suivez",
    verification: "Votre demande de vérification a été examinée",
    moderation: "Vous avez un avis de la modération",
    message: "vous a écrit",
    poll_end: "Un sondage est terminé",
    newMessage: "Nouveau message",
    someone: "Quelqu'un",
  },
  en: {
    like: "liked your post",
    reply: "replied to your post",
    repost: "reposted your post",
    quote: "quoted your post",
    follow: "followed you",
    mention: "mentioned you",
    following_post: "posted",
    official_post: "Your official posted",
    interpellation_answer: "answered a question you follow",
    verification: "Your verification request was reviewed",
    moderation: "A moderation notice concerns you",
    message: "sent you a message",
    poll_end: "A poll has ended",
    newMessage: "New message",
    someone: "Someone",
  },
} as const;

export const CATEGORY_LABELS: Record<Lang, Record<Category, { label: string; help: string }>> = {
  fr: {
    messages: { label: "Messages privés", help: "Quand quelqu'un vous écrit." },
    replies: { label: "Réponses et citations", help: "Quand on répond à vos publications ou qu'on les cite." },
    mentions: { label: "Mentions", help: "Quand quelqu'un écrit votre @nom." },
    follows: { label: "Nouveaux abonnés", help: "Quand quelqu'un s'abonne à vous." },
    following_posts: { label: "Publications de vos abonnements", help: "Quand un compte que vous suivez publie." },
    official_posts: { label: "Publications de vos élus", help: "Quand un élu de votre circonscription publie." },
    civic: { label: "Interpellations et sondages", help: "Réponses aux interpellations que vous soutenez, fin des sondages." },
    likes: { label: "J'aime", help: "Quand on aime vos publications." },
    reposts: { label: "Republications", help: "Quand on republie vos publications." },
  },
  en: {
    messages: { label: "Direct messages", help: "When someone writes to you." },
    replies: { label: "Replies and quotes", help: "When someone replies to or quotes your posts." },
    mentions: { label: "Mentions", help: "When someone writes your @handle." },
    follows: { label: "New followers", help: "When someone follows you." },
    following_posts: { label: "Posts from accounts you follow", help: "When an account you follow posts." },
    official_posts: { label: "Posts from your officials", help: "When an official for where you vote posts." },
    civic: { label: "Public questions and polls", help: "Answers to questions you back, polls that end." },
    likes: { label: "Likes", help: "When someone likes your posts." },
    reposts: { label: "Reposts", help: "When someone reposts your posts." },
  },
};

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

export type NotifContext = {
  type: NotifType;
  actorName: string | null;
  postText?: string | null;
  messageText?: string | null;
  lang: Lang;
  previews?: boolean;
};

/** Title and body for a toast or a push notification. */
export function describe(n: NotifContext): { title: string; body: string } {
  const c = COPY[n.lang];
  const who = n.actorName || c.someone;
  const quote = n.postText ? clip(n.postText.replace(/\s+/g, " ").trim(), 140) : "";
  switch (n.type) {
    case "message":
      return { title: who, body: n.previews !== false && n.messageText ? clip(n.messageText, 180) : c.message };
    case "following_post":
      return { title: `${who} ${c.following_post}`, body: quote };
    case "official_post":
      return { title: `${c.official_post} · ${who}`, body: quote };
    case "verification":
    case "moderation":
    case "poll_end":
      return { title: "POLITIQUE", body: c[n.type] };
    default:
      if (!quote) return { title: who, body: c[n.type] };
      return { title: who, body: n.lang === "fr" ? `${c[n.type]} : « ${quote} »` : `${c[n.type]}: “${quote}”` };
  }
}

/** Where tapping the notification leads. */
export function hrefFor(n: { type: NotifType; post_id: string | null; ref_id: string | null; actorHandle?: string | null }) {
  if (n.type === "message" && n.ref_id) return `/messages/${n.ref_id}`;
  if (n.type === "follow" && n.actorHandle) return `/u/${n.actorHandle}`;
  if (n.type === "interpellation_answer" && n.ref_id) return `/interpellations/${n.ref_id}`;
  if (n.type === "verification") return "/parametres#verification";
  if (n.post_id) return `/p/${n.post_id}`;
  return "/notifications";
}
