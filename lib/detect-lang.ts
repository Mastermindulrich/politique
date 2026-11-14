/**
 * A light guess at whether a short text is French or English, from common words and
 * French accents. Returns null when it cannot tell (very short text, names, Nouchi,
 * emojis...), in which case the translate button is offered anyway.
 */
const FR = new Set("le la les un une des du de et est sont pas pour dans sur avec que qui ne nous vous ils elles mais au aux ce cette ces il elle on mon ma mes notre nos votre vos leur leurs très bien tout tous fait être avoir ça c'est j'ai merci bonjour quoi comme aussi encore depuis chez".split(" "));
const EN = new Set("the a an and is are not for in on with that who we you they but to of this these it he she my our your their very well all done be have thanks hello what like also still since at from was were will would can should there here".split(" "));

export function detectLang(text: string): "fr" | "en" | null {
  const words = text
    .toLowerCase()
    .replace(/https?:\/\/\S+|[#@][\p{L}\p{N}_]+/gu, " ")
    .split(/[^\p{L}']+/u)
    .filter(Boolean);
  let fr = 0;
  let en = 0;
  for (const w of words) {
    if (FR.has(w)) fr++;
    if (EN.has(w)) en++;
  }
  fr += (text.match(/[éèêàâçùûîôœ]/gi) ?? []).length > 0 ? 1.5 : 0;
  if (fr + en < 1.5) return null;
  if (fr >= en * 1.5) return "fr";
  if (en >= fr * 1.5) return "en";
  return null;
}
