import Link from "next/link";
import { Wordmark } from "./components/wordmark";

/** Any address that leads nowhere: say so plainly and offer the ways back in. */
export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-paper px-6 text-center">
      <Wordmark />
      <p className="mt-8 font-display text-[44px] font-bold leading-none text-muted">404</p>
      <h1 className="mt-3 font-display text-[24px] font-bold leading-tight text-ink">Cette page n&apos;existe pas ou n&apos;existe plus.</h1>
      <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-muted">
        Le lien est peut-être incomplet, ou le contenu a été supprimé.
      </p>
      <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted" lang="en">This page does not exist or is no longer available.</p>
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <Link href="/" className="btn-primary h-11 px-6">Retour à l&apos;accueil</Link>
        <Link href="/explorer" className="btn-ghost h-11 px-6">Explorer</Link>
        <Link href="/elus" className="btn-ghost h-11 px-6">Les élus</Link>
      </div>
    </main>
  );
}
