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
