import "./globals.css";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { site } from "@/lib/content";
import { getViewer } from "@/lib/supabase/server";

export const viewport: Viewport = { themeColor: "#0A7A4A", width: "device-width", initialScale: 1 };

export const metadata: Metadata = {
  metadataBase: new URL(site.origin),
  applicationName: site.name,
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const viewer = await getViewer();
  const theme = viewer?.theme ?? (store.get("theme")?.value as "system" | "light" | "dark" | undefined) ?? "system";
  const lang = viewer?.lang ?? store.get("lang")?.value ?? "fr";
  return (
    <html lang={lang} data-theme={theme}>
      <head>
        {/* Fonts load from Google at runtime, so the build never depends on fetching them. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@600;700&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
