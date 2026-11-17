/**
 * POLITIQUE's mark, "Hémicycle": the seats of an assembly in the country's colours, with the
 * speaker's stand in the middle. Every icon, favicon, splash screen and share image is drawn
 * from these SVGs. To change the mark, edit this file and run `npm run brand` (it rewrites the
 * PNG/ICO files in app/, public/icons/ and mobile/assets/).
 */

export const brand = {
  orange: "#F07C00",
  green: "#0A7A4A",
  white: "#FFFFFF",
  ink: "#16181C",
  inkDeep: "#0F1113",
  paper: "#FAF8F4",
} as const;

type Row = [radius: number, seats: number];

/** Seats on concentric half circles; the left third is orange, the middle white, the right green. */
function seats(rows: Row[], r: number, cx = 512, cy = 690, mono?: string) {
  let out = "";
  for (const [radius, n] of rows) {
    for (let i = 0; i < n; i++) {
      const t = Math.PI * (1 - i / (n - 1));
      const x = cx + radius * Math.cos(t);
      const y = cy - radius * Math.sin(t);
      const deg = (t * 180) / Math.PI;
      const fill = mono ?? (deg > 119 ? brand.orange : deg < 61 ? brand.green : brand.white);
      out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${fill}"/>`;
    }
  }
  return out;
}

/** The mark alone (seats and stand), on a 1024 grid, centred on (512, 520). */
export function markSvg(mono?: string) {
  return `${seats([[176, 5], [266, 7], [356, 9]], 34, 512, 690, mono)}<rect x="432" y="640" width="160" height="100" rx="28" fill="${mono ?? brand.white}"/>`;
}

/** A sparser mark that stays readable at 16 and 32 pixels (browser tabs, bookmarks). */
function smallMarkSvg(mono?: string) {
  return `${seats([[205, 3], [355, 5]], 66, 512, 700, mono)}<rect x="402" y="626" width="220" height="140" rx="40" fill="${mono ?? brand.white}"/>`;
}

const bg = `<radialGradient id="bg" cx=".5" cy=".35" r=".8"><stop offset="0" stop-color="#262A30"/><stop offset="1" stop-color="#111316"/></radialGradient>`;
const svg = (body: string, defs = "", size = 1024) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024"><defs>${defs}</defs>${body}</svg>`;

/** Full-bleed square app icon. iOS, Android and the stores round the corners themselves. */
export const iconSvg = svg(`<rect width="1024" height="1024" fill="url(#bg)"/>${markSvg()}`, bg);

/** Same, with rounded corners baked in, for places that show the image as it is (desktop installs, share cards). */
export const iconRoundedSvg = svg(`<rect width="1024" height="1024" rx="230" fill="url(#bg)"/>${markSvg()}`, bg);

/** Android adaptive / PWA maskable: the mark shrunk into the central safe circle. */
export const maskableSvg = svg(`<rect width="1024" height="1024" fill="url(#bg)"/><g transform="translate(512 520) scale(.74) translate(-512 -520)">${markSvg()}</g>`, bg);

/** Android adaptive icon foreground layer (transparent), mark inside the 66% safe zone. */
export const foregroundSvg = svg(`<g transform="translate(512 520) scale(.6) translate(-512 -520)">${markSvg()}</g>`);

/** Android adaptive icon background layer. */
export const backgroundSvg = svg(`<rect width="1024" height="1024" fill="url(#bg)"/>`, bg);

/** Favicon: rounded square with the sparse mark. */
export const faviconSvg = svg(`<rect width="1024" height="1024" rx="230" fill="${brand.ink}"/>${smallMarkSvg()}`, "", 64);

/** Android notification badge: one colour on transparent (the system tints it). */
export const badgeSvg = svg(`<g transform="translate(512 520) scale(1.12) translate(-512 -520)">${smallMarkSvg("#FFFFFF")}</g>`);

export const svgDataUri = (s: string) => `data:image/svg+xml;base64,${Buffer.from(s).toString("base64")}`;

/** The mark cropped to its own bounds (784 x 470), for share images. */
export const markOnlySvg = (mono?: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="784" height="470" viewBox="120 290 784 470">${markSvg(mono)}</svg>`;
