type P = { className?: string; filled?: boolean };
const base = (p: P, children: React.ReactNode, filled = false) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill={filled && p.filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={p.className ?? "h-6 w-6"}>
    {children}
  </svg>
);

export const I = {
  home: (p: P) => base(p, <><path d="M3 11 12 3l9 8" /><path d="M5 10v10h5v-6h4v6h5V10" /></>, true),
  search: (p: P) => base(p, <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>),
  bell: (p: P) => base(p, <><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></>, true),
  mail: (p: P) => base(p, <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>),
  people: (p: P) => base(p, <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9" r="2.5" /><path d="M15.5 14.5a5 5 0 0 1 6 5" /></>),
  landmark: (p: P) => base(p, <><path d="m3 9 9-6 9 6" /><path d="M4 21h16" /><path d="M6 21v-9M10 21v-9M14 21v-9M18 21v-9" /></>),
  bookmark: (p: P) => base(p, <path d="M6 3h12v18l-6-4-6 4z" />, true),
  user: (p: P) => base(p, <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>),
  settings: (p: P) => base(p, <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>),
  sliders: (p: P) => base(p, <><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></>),
  shield: (p: P) => base(p, <><path d="M12 2.5 20 6v6c0 5-3.5 8.5-8 9.5-4.5-1-8-4.5-8-9.5V6z" /><path d="m9 12 2 2 4-4" /></>),
  reply: (p: P) => base(p, <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z" />),
  repost: (p: P) => base(p, <><path d="M17 2.5 21 6.5l-4 4" /><path d="M3 11V8.5a2 2 0 0 1 2-2h16" /><path d="M7 21.5l-4-4 4-4" /><path d="M21 13v2.5a2 2 0 0 1-2 2H3" /></>),
  heart: (p: P) => base(p, <path d="M12 20.5s-8-4.6-8-10.4A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 8 3.1c0 5.8-8 10.4-8 10.4z" />, true),
  share: (p: P) => base(p, <><path d="M12 3v13" /><path d="m7 8 5-5 5 5" /><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></>),
  more: (p: P) => base(p, <><circle cx="5" cy="12" r="1.6" fill="currentColor" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /><circle cx="19" cy="12" r="1.6" fill="currentColor" /></>),
  eye: (p: P) => base(p, <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>),
  image: (p: P) => base(p, <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="m21 16-5-5-8 8" /></>),
  video: (p: P) => base(p, <><rect x="2" y="5" width="15" height="14" rx="2" /><path d="m17 10 5-3v10l-5-3z" /></>),
  poll: (p: P) => base(p, <><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></>),
  pin: (p: P) => base(p, <><path d="M12 21s7-6.2 7-11.5a7 7 0 1 0-14 0C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>),
  x: (p: P) => base(p, <path d="M6 6l12 12M18 6 6 18" />),
  camera: (p: P) => base(p, <><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13.5" r="3.5" /></>),
  mic: (p: P) => base(p, <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0" /><path d="M12 17.5V21" /></>),
  clip: (p: P) => base(p, <path d="m20 11.5-8.2 8.2a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8" />),
  file: (p: P) => base(p, <><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" /><path d="M14 3v5h5" /></>),
  download: (p: P) => base(p, <><path d="M12 4v11" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" /></>),
  plus: (p: P) => base(p, <path d="M12 5v14M5 12h14" />),
  check: (p: P) => base(p, <path d="m5 12.5 4.5 4.5L19 7.5" />),
  back: (p: P) => base(p, <path d="m15 5-7 7 7 7" />),
  send: (p: P) => base(p, <><path d="M21 3 10.5 13.5" /><path d="M21 3 14 21l-3.5-7.5L3 10z" /></>),
  flag: (p: P) => base(p, <><path d="M5 21V4" /><path d="M5 4h12l-2 4 2 4H5" /></>),
  trash: (p: P) => base(p, <><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 14h10l1-14" /></>),
  logout: (p: P) => base(p, <><path d="M10 4H5v16h5" /><path d="M14 8l4 4-4 4" /><path d="M18 12H9" /></>),
  chart: (p: P) => base(p, <><path d="M3 20h18" /><path d="m4 15 5-5 4 4 7-7" /></>),
  bulb: (p: P) => base(p, <><path d="M9 18h6" /><path d="M10 21h4" /><path d="M8.5 14.5A6 6 0 1 1 15.5 14.5c-.6.6-1 1.5-1 2.5h-5c0-1-.4-1.9-1-2.5z" /></>),
  question: (p: P) => base(p, <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 1-1 1.7" /><circle cx="12" cy="17" r=".6" fill="currentColor" /></>),
  calendar: (p: P) => base(p, <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18" /><path d="M8 3v4M16 3v4" /></>),
  globe: (p: P) => base(p, <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z" /></>),
  whatsapp: (p: P) => (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className={p.className ?? "h-6 w-6"}>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 12 12 0 0 0 4.6 4c.6.3 1.1.4 1.5.5.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2s.2-1.1.1-1.2c0-.1-.2-.2-.5-.3z" />
    </svg>
  ),
};
