import type { AccountType } from "@/lib/types";

export const badgeColor: Record<AccountType, string> = {
  citoyen: "#0A7A4A",
  elu: "#0A7A4A",
  institution: "#5B6168",
  media: "#F07C00",
};

/** The verified badge. Green for elected officials, orange for media, grey for institutions. */
export function VerifiedBadge({ type, size = 18, title = "Compte vérifié" }: { type: AccountType; size?: number; title?: string }) {
  return (
    <svg role="img" aria-label={title} viewBox="0 0 24 24" width={size} height={size} className="inline-block flex-none align-text-bottom">
      <path fill={badgeColor[type]} d="M12 2.5 14.6 5l3.5-.4.9 3.4 3 1.9-1.6 3.1 1.6 3.1-3 1.9-.9 3.4-3.5-.4L12 21.5 9.4 19l-3.5.4L5 16l-3-1.9L3.6 11 2 7.9l3-1.9.9-3.4L9.4 5z" />
      <path d="m8.5 12 2.3 2.3L15.5 9.5" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TypeChip({ type, label }: { type: AccountType; label: string }) {
  const cls = type === "elu" ? "bg-green-soft text-green-deep" : type === "media" ? "bg-orange-soft text-orange" : type === "institution" ? "bg-paper text-muted" : "bg-paper text-muted";
  return <span className={`chip ${cls}`}>{label}</span>;
}

export const OWNER_LABEL = { fr: "Fondateur de POLITIQUE", en: "Founder of POLITIQUE" } as const;
type BadgeLang = keyof typeof OWNER_LABEL;

function Crown({ color = "#F5B800" }: { color?: string }) {
  return <path fill={color} d="M6.2 15.6 5 8.6l3.6 2.8L12 6l3.4 5.4L19 8.6l-1.2 7z M6.6 16.9h10.8v1.6H6.6z" />;
}

/**
 * The founder's badge: a gold crown on an ink seal with a gold ring. Only one account can
 * ever show it: it reads profiles.is_owner, which the database lets no one set or change
 * (see migration 0005_owner_badge.sql).
 */
export function OwnerBadge({ size = 18, lang = "fr" }: { size?: number; lang?: BadgeLang }) {
  return (
    <svg role="img" aria-label={OWNER_LABEL[lang]} viewBox="0 0 24 24" width={size} height={size} className="inline-block flex-none align-text-bottom">
      <title>{OWNER_LABEL[lang]}</title>
      <circle cx="12" cy="12" r="10.6" fill="#16181C" stroke="#F5B800" strokeWidth="1.8" />
      <Crown />
    </svg>
  );
}

/** Larger labelled chip for the founder's profile header. */
export function OwnerChip({ lang = "fr" }: { lang?: BadgeLang }) {
  return (
    <span className="chip inline-flex items-center gap-1 border border-[#F5B800] bg-[#16181C] font-semibold text-[#F5B800]">
      <svg aria-hidden="true" viewBox="4 5 16 14" width={14} height={12} className="flex-none"><Crown /></svg>
      <span>{OWNER_LABEL[lang]}</span>
    </span>
  );
}

type Badged = { verified?: boolean | null; is_owner?: boolean | null; account_type: AccountType };

/**
 * The badge shown after a name. The founder gets the crown instead of the verified tick;
 * everyone else gets the verified tick when verified.
 */
export function NameBadge({ p, size = 18, lang = "fr", verifiedTitle }: { p: Badged; size?: number; lang?: BadgeLang | string; verifiedTitle?: string }) {
  const l: BadgeLang = lang === "en" ? "en" : "fr";
  if (p.is_owner) return <OwnerBadge size={size} lang={l} />;
  if (p.verified) return <VerifiedBadge type={p.account_type} size={size} title={verifiedTitle ?? (l === "en" ? "Verified account" : "Compte vérifié")} />;
  return null;
}
