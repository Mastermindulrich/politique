import "./globals.css";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Suspense } from "react";
import { NavProgress } from "./components/shell/nav-progress";
import { site } from "@/lib/content";

// Fonts ship with the site (no request to another server, no flash of fallback text).
const sans = localFont({ src: "./fonts/inter-latin.woff2", variable: "--font-sans", weight: "100 900", display: "swap" });
const display = localFont({ src: "./fonts/space-grotesk-latin.woff2", variable: "--font-display", weight: "300 700", display: "swap" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0f11" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(site.origin),
  applicationName: site.name,
  // Installed on a phone's home screen, the site opens like an app (and iPhones then allow Web Push).
  appleWebApp: { capable: true, title: "POLITIQUE", statusBarStyle: "default" },
  title: {
    default: "POLITIQUE — Le réseau social politique de la Côte d'Ivoire",
    template: "%s | POLITIQUE",
  },
  description:
    "POLITIQUE met les citoyens et leurs élus sur le même espace public : publications, sondages, interpellations et comptes vérifiés.",
  openGraph: {
    type: "website",
    siteName: site.name,
    locale: "fr_CI",
    alternateLocale: "en_US",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

// The root layout reads no cookie on the server, so public pages can be served from the
// edge cache. Theme and language come from the visitor's cookies, applied before paint.
const prefs =
  "(function(){try{var c=document.cookie,d=document.documentElement,t=c.match(/(?:^|; )theme=(light|dark|system)/),l=c.match(/(?:^|; )lang=(fr|en)/);if(t)d.setAttribute('data-theme',t[1]);if(l)d.lang=l[1]}catch(e){}})()";

// Page translation (Safari, Chrome, Google Translate) swaps the text React wrote for its own
// nodes. When React later adds or removes a node next to that text, the browser throws and
// the whole page turns into "Application error". This guard lets those operations through
// quietly instead (the approach suggested by the React team in facebook/react#11538).
const domGuard =
  "(function(){if(typeof Node!=='function'||!Node.prototype)return;var r=Node.prototype.removeChild;Node.prototype.removeChild=function(c){if(c.parentNode!==this)return c;return r.apply(this,arguments)};var i=Node.prototype.insertBefore;Node.prototype.insertBefore=function(n,ref){if(ref&&ref.parentNode!==this)return n;return i.apply(this,arguments)}})()";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" data-theme="system" className={`${sans.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: prefs }} />
        <script dangerouslySetInnerHTML={{ __html: domGuard }} />
      </head>
      <body>
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
