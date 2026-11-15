import { createHmac, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { LinkPreview } from "@/lib/types";

/**
 * Link previews: the card (title, description, image) shown under a post that contains a link.
 * The server fetches the page itself, so every fetch is checked against private addresses,
 * capped in size and time, and never follows a redirect it has not checked the same way.
 */

const URL_RE = /https?:\/\/[^\s<]+[^\s<.,;:!?)"']/i;
const MAX_BYTES = 300_000;

export function firstUrl(text: string): string | null {
  return URL_RE.exec(text)?.[0] ?? null;
}

function privateV4(ip: string) {
  const [a, b] = ip.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
}
function privateIp(ip: string) {
  if (isIP(ip) === 4) return privateV4(ip);
  const v = ip.toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
  if (mapped) return privateV4(mapped[1]);
  return v === "::" || v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb") || v.startsWith("::ffff:") || v.startsWith("64:ff9b:");
}

/** Only public http(s) hosts on the default ports. */
async function publicUrl(raw: string): Promise<URL | null> {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.port || u.username || u.password) return null;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (!host.includes(".") && isIP(host) === 0) return null; // localhost, intranet names
  if (isIP(host)) return privateIp(host) ? null : u;
  try {
    const addrs = await lookup(host, { all: true });
    if (!addrs.length || addrs.some((a) => privateIp(a.address))) return null;
  } catch { return null; }
  return u;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", eacute: "é", egrave: "è", ecirc: "ê", agrave: "à", ccedil: "ç", ocirc: "ô", ucirc: "û", icirc: "î", rsquo: "’", lsquo: "‘", laquo: "«", raquo: "»", hellip: "…", ndash: "–", mdash: "—" };
function decode(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}
function meta(html: string, ...names: string[]) {
  for (const name of names) {
    const tag = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, "i").exec(html)?.[0];
    const content = tag && /content=(?:"([^"]*)"|'([^']*)')/i.exec(tag);
    const v = content ? decode(content[1] ?? content[2] ?? "") : "";
    if (v) return v;
  }
  return "";
}

export async function fetchPreview(raw: string, timeoutMs = 4000): Promise<LinkPreview | null> {
  const signal = AbortSignal.timeout(timeoutMs);
  let target = await publicUrl(raw);
  try {
    for (let hop = 0; target && hop < 4; hop++) {
      const res = await fetch(target, { redirect: "manual", signal, headers: { "User-Agent": "POLITIQUEbot/1.0 (link preview)", Accept: "text/html,application/xhtml+xml", "Accept-Language": "fr,en;q=0.8" } });
      if (res.status >= 300 && res.status < 400) {
        const next = res.headers.get("location");
        await res.body?.cancel();
        target = next ? await publicUrl(new URL(next, target).toString()) : null;
        continue;
      }
      if (!res.ok || !/text\/html|application\/xhtml/i.test(res.headers.get("content-type") ?? "") || !res.body) {
        await res.body?.cancel();
        return null;
      }
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (size < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        size += value.length;
      }
      await reader.cancel().catch(() => {});
      const html = Buffer.concat(chunks).toString("utf8");
      const title = (meta(html, "og:title", "twitter:title") || decode(/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? "")).slice(0, 140);
      if (!title) return null;
      const description = meta(html, "og:description", "twitter:description", "description").slice(0, 240);
      let image: string | undefined;
      const img = meta(html, "og:image:secure_url", "og:image", "twitter:image");
      if (img) {
        try {
          const abs = new URL(img, target);
          if (abs.protocol === "https:" && abs.toString().length < 600) image = abs.toString();
        } catch { /* ignore a malformed image address */ }
      }
      const site = (meta(html, "og:site_name") || target.hostname.replace(/^www\./, "")).slice(0, 60);
      return { url: raw, title, description: description || undefined, image, site };
    }
  } catch { /* timeout, network error: no preview */ }
  return null;
}

// The composer shows the preview while the person types; signing it lets the server
// attach that same card on publish without fetching the page a second time.
const secret = () => process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const digest = (p: LinkPreview) => createHmac("sha256", secret()).update(JSON.stringify([p.url, p.title, p.description ?? "", p.image ?? "", p.site])).digest("hex");

export function signPreview(p: LinkPreview) {
  return secret() ? digest(p) : "";
}
export function verifyPreview(p: LinkPreview, sig: string) {
  if (!secret() || !sig) return false;
  const a = Buffer.from(digest(p));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}
