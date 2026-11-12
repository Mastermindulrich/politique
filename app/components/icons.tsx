import type { IconName } from "@/lib/content";

const paths: Record<IconName, React.ReactNode> = {
  feed: (
    <>
      <rect x="3" y="4" width="18" height="6" rx="1.5" />
      <rect x="3" y="14" width="18" height="6" rx="1.5" />
    </>
  ),
  badge: (
    <>
      <path d="M12 2.5 14.6 5l3.5-.4.9 3.4 3 1.9-1.6 3.1 1.6 3.1-3 1.9-.9 3.4-3.5-.4L12 21.5 9.4 19l-3.5.4L5 16l-3-1.9L3.6 11 2 7.9l3-1.9.9-3.4L9.4 5z" />
      <path d="m8.5 12 2.3 2.3L15.5 9.5" />
    </>
  ),
  poll: (
    <>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20H2" />
    </>
  ),
  video: (
    <>
      <rect x="2" y="5" width="15" height="14" rx="2" />
      <path d="m17 10 5-3v10l-5-3z" />
    </>
  ),
  map: (
    <>
      <path d="M12 21s7-6.2 7-11.5a7 7 0 1 0-14 0C5 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2.5 20 6v6c0 5-3.5 8.5-8 9.5-4.5-1-8-4.5-8-9.5V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  chat: (
    <>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z" />
    </>
  ),
  chart: (
    <>
      <path d="M3 20h18" />
      <path d="m4 15 5-5 4 4 7-7" />
      <path d="M16 7h4v4" />
    </>
  ),
};

export function Icon({ name, className = "h-6 w-6" }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {paths[name]}
    </svg>
  );
}

export function Check({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function Verified({ color, className = "h-[18px] w-[18px]", title }: { color: string; className?: string; title: string }) {
  return (
    <svg role="img" aria-label={title} viewBox="0 0 24 24" className={className}>
      <path
        fill={color}
        d="M12 2.5 14.6 5l3.5-.4.9 3.4 3 1.9-1.6 3.1 1.6 3.1-3 1.9-.9 3.4-3.5-.4L12 21.5 9.4 19l-3.5.4L5 16l-3-1.9L3.6 11 2 7.9l3-1.9.9-3.4L9.4 5z"
      />
      <path d="m8.5 12 2.3 2.3L15.5 9.5" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
