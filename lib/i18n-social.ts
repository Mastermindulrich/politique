/**
 * Words for the social features added after launch: editing and pinning a post, link cards,
 * group messages and the word filter.
 * Kept in its own file so the main dictionary stays readable.
 */

const fr = {
  post: {
    edit: "Modifier", editTitle: "Modifier la publication", editHint: "Vous pouvez modifier une publication pendant une heure. Les versions précédentes restent visibles.",
    save: "Enregistrer", edited: "Modifié", history: "Historique des modifications", current: "Version actuelle", original: "Version précédente",
    pin: "Épingler sur mon profil", unpin: "Retirer du haut du profil", pinned: "Épinglé",
  },
  messages: {
    new: "Nouveau message", to: "À", searchPeople: "Chercher une personne", noResult: "Personne ne correspond.", start: "Écrire", createGroup: "Créer le groupe",
    groupName: "Nom du groupe (facultatif)", members: "membres", leave: "Quitter le groupe", leaveConfirm: "Quitter ce groupe ? Vous ne verrez plus ses messages.",  emptyGroup: "Nouveau groupe", pickHint: "Choisissez une personne pour une conversation, ou plusieurs pour un groupe.",
  },
  filter: {
    tab: "Mots bloqués", intro: "Une publication qui contient l'un de ces mots est refusée avant d'être publiée. Les accents et les majuscules ne comptent pas.",
    add: "Ajouter", placeholder: "Mot ou expression", empty: "Aucun mot bloqué pour le moment.", remove: "Retirer",
  },
  errors: {
    rate_limit: "Vous allez trop vite. Patientez un instant avant de réessayer.",
    duplicate_post: "Vous venez de publier ce même texte.",
    blocked_term: "Ce texte contient un mot qui n'est pas autorisé sur POLITIQUE.",
    too_many_links: "Trop de liens dans ce texte (quatre au maximum).",
    too_many_mentions: "Trop de personnes mentionnées (dix au maximum).",
    edit_window: "Une publication ne peut être modifiée que pendant l'heure qui suit.",
    edit_limit: "Cette publication a déjà été modifiée cinq fois.",
    poll_has_votes: "Ce sondage a déjà reçu des votes : il ne peut plus être modifié.",
    blocked: "Vous ne pouvez pas écrire à cette personne.",
    not_allowed: "Cette action n'est pas disponible pour le moment.",
    too_big: "Image trop lourde (8 Mo au maximum).",
  },
};

const en: typeof fr = {
  post: {
    edit: "Edit", editTitle: "Edit post", editHint: "You can edit a post for one hour. Earlier versions stay visible.",
    save: "Save", edited: "Edited", history: "Edit history", current: "Current version", original: "Earlier version",
    pin: "Pin to my profile", unpin: "Unpin from profile", pinned: "Pinned",
  },
  messages: {
    new: "New message", to: "To", searchPeople: "Search for someone", noResult: "No one matches.", start: "Message", createGroup: "Create group",
    groupName: "Group name (optional)", members: "members", leave: "Leave group", leaveConfirm: "Leave this group? You will no longer see its messages.",  emptyGroup: "New group", pickHint: "Pick one person for a conversation, or several for a group.",
  },
  filter: {
    tab: "Blocked words", intro: "A post containing one of these words is refused before it is published. Accents and capitals do not matter.",
    add: "Add", placeholder: "Word or phrase", empty: "No blocked words yet.", remove: "Remove",
  },
  errors: {
    rate_limit: "You are going too fast. Wait a moment before trying again.",
    duplicate_post: "You just posted this same text.",
    blocked_term: "This text contains a word that is not allowed on POLITIQUE.",
    too_many_links: "Too many links in this text (four at most).",
    too_many_mentions: "Too many people mentioned (ten at most).",
    edit_window: "A post can only be edited during the hour after it was published.",
    edit_limit: "This post has already been edited five times.",
    poll_has_votes: "This poll already has votes and can no longer be edited.",
    blocked: "You cannot write to this person.",
    not_allowed: "This action is not available right now.",
    too_big: "Image too large (8 MB at most).",
  },
};

export function social(lang: string | null | undefined) {
  return lang === "en" ? en : fr;
}

/** The sentence shown for an error code returned by a server action. */
export function errorText(code: string | undefined, lang: string | null | undefined, fallback: string) {
  const e = social(lang).errors as Record<string, string>;
  if (!code) return fallback;
  // The database answers with a short code, sometimes wrapped in a longer message.
  for (const key of Object.keys(e)) if (code.includes(key)) return e[key];
  if (code.includes("row-level security")) return e.not_allowed;
  return fallback;
}
