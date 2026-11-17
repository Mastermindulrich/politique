// Renders every icon, favicon and splash file from lib/brand.ts.
// Run with `npm run brand` (needs Playwright's Chromium: `npx playwright install chromium` once).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { backgroundSvg, badgeSvg, faviconSvg, foregroundSvg, iconRoundedSvg, iconSvg, markSvg, maskableSvg, svgDataUri } from "../lib/brand.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require("playwright"); } catch { playwright = createRequire("/usr/")("playwright"); }
const browser = await playwright.chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function png(svg: string, size: number, transparent = true) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>*{margin:0}html,body{background:transparent}</style><img src="${svgDataUri(svg)}" style="display:block;width:${size}px;height:${size}px">`);
  await page.waitForFunction(() => document.images[0]?.complete);
  return page.screenshot({ omitBackground: transparent, type: "png" });
}

async function out(path: string, data: Buffer | string) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), data);
  console.log("wrote", path);
}

/** A .ico holding PNG images (supported by every browser since IE Vista era). */
function ico(images: { size: number; data: Buffer }[]) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const o = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, o); header.writeUInt8(size >= 256 ? 0 : size, o + 1);
    header.writeUInt16LE(1, o + 4); header.writeUInt16LE(32, o + 6);
    header.writeUInt32LE(data.length, o + 8); header.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((i) => i.data)]);
}

// Website
await out("app/icon.svg", faviconSvg + "\n");
await out("app/favicon.ico", ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(faviconSvg, size) })))));
await out("app/apple-icon.png", await png(iconSvg, 180, false));
await out("public/icons/icon-192.png", await png(iconRoundedSvg, 192));
await out("public/icons/icon-512.png", await png(iconRoundedSvg, 512));
await out("public/icons/maskable-192.png", await png(maskableSvg, 192, false));
await out("public/icons/maskable-512.png", await png(maskableSvg, 512, false));
await out("public/icons/badge-96.png", await png(badgeSvg, 96));
await out("public/brand/politique-icon-1024.png", await png(iconSvg, 1024, false));

// Native apps (Capacitor). `npx @capacitor/assets generate` in mobile/ turns these into every
// Android/iOS size. Splash content stays in the centre so any screen shape can crop it.
await out("mobile/assets/icon-only.png", await png(iconSvg, 1024, false));
await out("mobile/assets/icon-foreground.png", await png(foregroundSvg, 1024));
await out("mobile/assets/icon-background.png", await png(backgroundSvg, 1024, false));
const font = (await readFile(join(root, "app/fonts/space-grotesk-latin.woff2"))).toString("base64");
const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
<defs><radialGradient id="s" cx=".5" cy=".42" r=".7"><stop offset="0" stop-color="#23272D"/><stop offset="1" stop-color="#0F1113"/></radialGradient>
<style>@font-face{font-family:SG;src:url(data:font/woff2;base64,${font})}</style></defs>
<rect width="2732" height="2732" fill="url(#s)"/>
<g transform="translate(1366 1250) scale(.95) translate(-512 -520)">${markSvg()}</g>
<text x="1366" y="1640" text-anchor="middle" font-family="SG" font-weight="700" font-size="104" letter-spacing="26" fill="#FFFFFF">POLITIQUE</text></svg>`;
await page.setViewportSize({ width: 2732, height: 2732 });
await page.setContent(`<style>*{margin:0}</style>${splashSvg}`);
await page.evaluate(() => document.fonts.ready);
const splash = await page.screenshot({ type: "png" });
await out("mobile/assets/splash.png", splash);
await out("mobile/assets/splash-dark.png", splash);

await browser.close();
