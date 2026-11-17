/**
 * The rule for a person's public name, the same as the database's valid_display_name():
 * 2 to 50 characters, at least two letters, no e-mail address and no link.
 */
export function cleanName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

export function nameOk(name: string): boolean {
  const n = cleanName(name);
  const letters = n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z]/g, "");
  return n.length >= 2 && n.length <= 50 && letters.length >= 2 && !n.includes("@") && !/(https?:\/\/|www\.)/i.test(n);
}

export const nameHelp = (lang: "fr" | "en") =>
  lang === "fr" ? "Indiquez votre nom (au moins deux lettres, sans adresse e-mail)." : "Enter your name (at least two letters, no e-mail address).";
