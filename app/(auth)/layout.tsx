import Link from "next/link";
import { Wordmark } from "../components/wordmark";

export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate flex min-h-[100dvh] flex-col bg-card sm:bg-paper">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 overflow-hidden">
        <div className="absolute -left-24 -top-32 h-72 w-72 rounded-full bg-[#0A7A4A]/[0.09] blur-3xl" />
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#F07C00]/[0.08] blur-3xl" />
      </div>
      <header className="flex h-14 items-center justify-between px-4 sm:h-16 sm:justify-center sm:border-b sm:border-line sm:bg-card" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <Link href="/" aria-label="POLITIQUE" className="tap rounded-lg"><Wordmark small /></Link>
        <Link href="/" aria-label="Retour à l'accueil" className="icon-btn sm:hidden">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </Link>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-10 pt-4 sm:px-4 sm:py-12">
        <div className="rise sm:rounded-3xl sm:border sm:border-line sm:bg-card sm:p-8 sm:shadow-[0_24px_60px_-40px_rgba(22,24,28,0.35)]">{children}</div>
      </main>
    </div>
  );
}
