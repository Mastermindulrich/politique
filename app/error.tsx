"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Wordmark } from "./components/wordmark";

/** Shown instead of a blank "Application error" page when something breaks inside a page. */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return <ErrorScreen onRetry={reset} />;
}

export function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-paper px-6 text-center">
      <Wordmark />
      <h1 className="mt-8 font-display text-[24px] font-bold leading-tight text-ink">Oups, cette page n&apos;a pas pu s&apos;afficher.</h1>
      <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-muted">
        Réessayez dans un instant. Si vous utilisez la traduction automatique du navigateur, désactivez-la puis rechargez la page.
      </p>
      <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted" lang="en">
        This page could not load. Please try again, or turn off your browser&apos;s automatic translation and reload.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={onRetry} className="btn-primary h-11 px-6">Réessayer</button>
        <Link href="/" className="btn-ghost h-11 px-6">Retour à l&apos;accueil</Link>
      </div>
    </main>
  );
}
