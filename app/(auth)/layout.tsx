import Link from "next/link";
import { Wordmark } from "../components/wordmark";

export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="flex h-16 items-center justify-center border-b border-line bg-card">
        <Link href="/" aria-label="POLITIQUE"><Wordmark /></Link>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8 sm:py-12">
        <div className="rounded-3xl border border-line bg-card p-6 sm:p-8">{children}</div>
      </main>
    </div>
  );
}
