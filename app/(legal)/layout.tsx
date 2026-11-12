import Link from "next/link";
import { Wordmark } from "../components/wordmark";
import { site } from "@/lib/content";
import { getLang } from "@/lib/lang";

export default async function LegalLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link href="/" aria-label="POLITIQUE"><Wordmark small /></Link>
          <nav className="flex gap-4 text-[14px] font-semibold text-muted">
            <Link href="/regles" className="hover:text-ink">{lang === "fr" ? "Règles" : "Rules"}</Link>
            <Link href="/confidentialite" className="hover:text-ink">{lang === "fr" ? "Confidentialité" : "Privacy"}</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">{children}</main>
      <footer className="border-t border-line">
        <p className="mx-auto max-w-3xl px-4 py-6 text-[13px] text-muted">
          © {new Date().getFullYear()} POLITIQUE · <a href={site.parent.url} className="hover:underline">{site.parent.name}</a>
        </p>
      </footer>
    </div>
  );
}
