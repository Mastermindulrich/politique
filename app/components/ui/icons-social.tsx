type P = { className?: string };
const svg = (p: P, children: React.ReactNode) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={p.className ?? "h-6 w-6"}>
    {children}
  </svg>
);

/** Icons for the features added after launch (editing, pinning, groups, photos in messages). */
export const S = {
  pencil: (p: P) => svg(p, <><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17z" /><path d="m14.5 7.5 3 3" /></>),
  pushpin: (p: P) => svg(p, <><path d="M9 3h6l-1 6 3.5 3.5v1.5h-11v-1.5L10 9z" /><path d="M12 14v7" /></>),
  compose: (p: P) => svg(p, <><path d="M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7" /><path d="M10 14l1-4L19.5 1.5a2.1 2.1 0 0 1 3 3L14 13z" /></>),
  clock: (p: P) => svg(p, <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  exit: (p: P) => svg(p, <><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /><path d="M10 8l-4 4 4 4" /><path d="M6 12h10" /></>),
  download: (p: P) => svg(p, <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" /></>),
};
