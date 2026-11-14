/** Only same-site paths may be used as a "come back here" target. */
export function safePath(next: string | undefined | null, fallback = "/accueil") {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}

/**
 * Where a visitor is sent when they reach something only members can do or see:
 * a page that says what they get by joining, with sign-up first and log-in second.
 */
export function joinHref(next?: string) {
  const here = next ?? (typeof window !== "undefined" ? window.location.pathname + window.location.search : "");
  return here && here !== "/" ? `/rejoindre?next=${encodeURIComponent(here)}` : "/rejoindre";
}
