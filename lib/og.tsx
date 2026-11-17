/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text */
// Shared pieces for the share images (Open Graph / X cards), drawn with next/og.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { brand, faviconSvg, markOnlySvg, svgDataUri } from "@/lib/brand";

export const ogSize = { width: 1200, height: 630 };

let fontsPromise: Promise<{ name: string; data: Buffer; weight: 400 | 600 | 700; style: "normal" }[]> | null = null;

/** Space Grotesk for titles, Inter for text: the same faces as the site. */
export function ogFonts() {
  fontsPromise ??= Promise.all([
    readFile(join(process.cwd(), "lib/og/fonts/SpaceGrotesk-Bold.ttf")).then((data) => ({ name: "Space Grotesk", data, weight: 700 as const, style: "normal" as const })),
    readFile(join(process.cwd(), "lib/og/fonts/Inter-Regular.ttf")).then((data) => ({ name: "Inter", data, weight: 400 as const, style: "normal" as const })),
    readFile(join(process.cwd(), "lib/og/fonts/Inter-SemiBold.ttf")).then((data) => ({ name: "Inter", data, weight: 600 as const, style: "normal" as const })),
  ]);
  return fontsPromise;
}

const icon = svgDataUri(faviconSvg);
const mark = svgDataUri(markOnlySvg());
const faintMark = svgDataUri(markOnlySvg("#FFFFFF"));
const check = svgDataUri(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="${brand.green}"/><path d="M7 12.5l3.2 3.2L17 9" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
);

export const muted = "#A3A8B0";

/** Dark stage with the tricolour line along the bottom, used by every share image. */
export function Frame({ children, bigMark = false }: { children: React.ReactNode; bigMark?: boolean }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        backgroundColor: brand.inkDeep,
        backgroundImage: "radial-gradient(circle at 30% 20%, #262A31 0%, #0F1113 70%)",
        color: "#fff",
        fontFamily: "Inter",
      }}
    >
      {bigMark ? (
        <img src={mark} width={560} height={336} style={{ position: "absolute", right: -70, bottom: 92 }} />
      ) : (
        <img src={faintMark} width={523} height={313} style={{ position: "absolute", right: -60, bottom: -40, opacity: 0.06 }} />
      )}
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: "56px 72px 64px" }}>{children}</div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 10, display: "flex" }}>
        <div style={{ flex: 1, backgroundColor: brand.orange }} />
        <div style={{ flex: 1, backgroundColor: "#fff" }} />
        <div style={{ flex: 1, backgroundColor: brand.green }} />
      </div>
    </div>
  );
}

/** Icon + POLITIQUE wordmark, with the address on the right. */
export function BrandBar({ size = 56 }: { size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <img src={icon} width={size} height={size} />
        <div style={{ fontFamily: "Space Grotesk", fontWeight: 700, fontSize: size * 0.62, letterSpacing: size * 0.13 }}>POLITIQUE</div>
      </div>
      <div style={{ fontSize: 24, color: muted }}>politique.prototypex.org</div>
    </div>
  );
}

export function VerifiedCheck({ size = 34 }: { size?: number }) {
  return <img src={check} width={size} height={size} />;
}

/** A round picture, or the initials when there is none (or it can't be drawn). */
export function Avatar({ src, name, size }: { src: string | null; name: string; size: number }) {
  if (src) return <img src={src} width={size} height={size} style={{ borderRadius: size, objectFit: "cover", border: "4px solid rgba(255,255,255,.12)" }} />;
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
  return (
    <div style={{ width: size, height: size, borderRadius: size, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#2B3038", color: "#fff", fontFamily: "Space Grotesk", fontWeight: 700, fontSize: size * 0.38 }}>
      {initials}
    </div>
  );
}

/**
 * Fetches a picture for a share image as a data URI. Only PNG and JPEG are drawn reliably,
 * so anything else (or a slow or missing file) falls back to null.
 */
export async function imageData(url: string | null | undefined): Promise<string | null> {
  if (!url || !/^https:\/\//.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    const type = res.headers.get("content-type")?.split(";")[0] ?? "";
    if (!res.ok || !/^image\/(png|jpeg)$/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 4_000_000) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Cuts text at a word boundary so it fits the card. */
export function clip(text: string, max: number) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).replace(/[\s,.;:!?-]+$/, "") + "…";
}

export const formatCount = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/ | /g, " ");

/** The site-wide share card (landing pages and anything without its own). */
export function SiteCard({ title, accent, body }: { title: string; accent: string; body: string }) {
  return (
    <Frame bigMark>
      <BrandBar />
      <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", marginBottom: 20, maxWidth: 660 }}>
        <div style={{ fontFamily: "Space Grotesk", fontWeight: 700, fontSize: 70, lineHeight: 1.04, letterSpacing: -2 }}>{title}</div>
        <div style={{ fontFamily: "Space Grotesk", fontWeight: 700, fontSize: 70, lineHeight: 1.04, letterSpacing: -2, color: brand.orange }}>{accent}</div>
        <div style={{ fontSize: 28, lineHeight: 1.4, color: muted, marginTop: 26 }}>{body}</div>
      </div>
    </Frame>
  );
}
