// Pure SDP helpers for calls (no browser APIs, so they can be tested in Node).

/** Opus at up to 96 kb/s (browsers default to ~32): clear, natural voices. */
export const AUDIO_MAX_BITRATE = 96_000;

/**
 * Tells the other side how to send us audio: Opus at full band (48 kHz), up to 96 kb/s, with
 * in-band error correction (FEC) so a lost packet does not cut a syllable. Only the Opus format
 * line of our own description changes; every browser accepts these standard parameters.
 */
export function tuneOpus(sdp: string): string {
  const pt = /a=rtpmap:(\d+) opus\/48000/i.exec(sdp)?.[1];
  if (!pt) return sdp;
  const want: Record<string, string> = { minptime: "10", useinbandfec: "1", stereo: "0", maxplaybackrate: "48000", maxaveragebitrate: String(AUDIO_MAX_BITRATE) };
  const line = new RegExp(`a=fmtp:${pt} ([^\r\n]*)`);
  const m = line.exec(sdp);
  if (!m) return sdp.replace(new RegExp(`(a=rtpmap:${pt} [^\r\n]*)(\r?\n)`), (_, l, nl) => `${l}${nl}a=fmtp:${pt} ${Object.entries(want).map(([k, v]) => `${k}=${v}`).join(";")}${nl}`);
  const params = new Map(m[1].split(";").map((x) => x.trim()).filter(Boolean).map((x) => x.split("=") as [string, string]));
  for (const [k, v] of Object.entries(want)) params.set(k, v);
  return sdp.replace(line, `a=fmtp:${pt} ${[...params].map(([k, v]) => `${k}=${v}`).join(";")}`);
}
