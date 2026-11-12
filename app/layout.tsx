import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { cookies } from "next/headers";
import { site } from "@/lib/content";
import { getViewer } from "@/lib/supabase/server";

const sans = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
});
const display = Space_Grotesk({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const viewport: Viewport = { themeColor: "#0A7A4A", width: "device-width", initialScale: 1 };

export const metadata: Metadata = {
  metadataBase: new URL(site.origin),
  applicationName: site.name,
  title: {
    default: "POLITIQUE — Le réseau social politique de la Côte d'Ivoire",
    template: "%s | POLITIQUE",
  },
  description:
    "POLITIQUE met les citoyens et leurs élus sur la même place publique : posts, sondages, débats vidéo et comptes vérifiés.",
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
    <html lang={lang} data-theme={theme} className={`${sans.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
