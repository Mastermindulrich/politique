import Link from "next/link";
import { content, site, type Lang } from "@/lib/content";
import { Check, Icon } from "./icons";
import { LandingCtaBar } from "./landing-cta-bar";
import MockFeed from "./mock-feed";

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="flag" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className={`font-display font-bold tracking-[0.14em] text-ink ${compact ? "text-[18px] sm:text-[22px]" : "text-[22px]"}`}>POLITIQUE</span>
    </span>
  );
}

export default function Landing({ lang }: { lang: Lang }) {
  const t = content[lang];
  const home = lang === "fr" ? "/" : "/en";

  return (
    <div data-theme="light" className="overflow-x-clip bg-bg text-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white">
        {lang === "fr" ? "Aller au contenu" : "Skip to content"}
      </a>

      <header className="sticky top-0 z-40 border-b border-line/80 bg-white/85 backdrop-blur-lg" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="container-x flex h-14 items-center justify-between gap-3 sm:h-16">
          <Link href={home} className="tap rounded-lg" aria-label={`${site.name} — ${lang === "fr" ? "accueil" : "home"}`}>
            <Wordmark compact />
          </Link>
          <nav aria-label="Navigation" className="hidden items-center gap-7 text-[15px] font-medium text-ink md:flex">
            <a href="#features" className="transition-colors hover:text-green-deep">{t.nav.features}</a>
            <a href="#who" className="transition-colors hover:text-green-deep">{t.nav.who}</a>
            <a href="#how" className="transition-colors hover:text-green-deep">{t.nav.how}</a>
            <a href="#faq" className="transition-colors hover:text-green-deep">{t.nav.faq}</a>
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href={t.nav.switchHref}
              hrefLang={lang === "fr" ? "en" : "fr"}
              aria-label={t.nav.switchLabel}
              className="tap flex h-9 items-center rounded-full px-3 text-[13px] font-bold tracking-wide text-muted hover:bg-paper hover:text-ink active:bg-line/60 sm:text-[14px]"
            >
              <span className="sm:hidden">{lang === "fr" ? "EN" : "FR"}</span>
              <span className="hidden sm:inline">{t.nav.switchLabel}</span>
            </Link>
            <Link href="/connexion" className="btn-ghost h-9 px-4 text-[14px] sm:h-10">{t.nav.login}</Link>
            <Link href="/inscription" className="btn-primary hidden h-10 px-4 text-[14px] sm:inline-flex">{t.nav.signup}</Link>
          </div>
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="relative isolate">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -left-32 -top-40 h-[420px] w-[420px] rounded-full bg-[#0A7A4A]/[0.10] blur-3xl" />
            <div className="absolute -right-40 top-32 h-[380px] w-[380px] rounded-full bg-[#F07C00]/[0.10] blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(rgba(22,24,28,0.06)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" />
          </div>
          <div className="container-x grid items-center gap-10 pb-12 pt-9 sm:pt-14 md:grid-cols-[1.1fr_0.9fr] md:gap-12 md:pb-24 md:pt-24">
            <div className="rise">
              <p className="inline-flex items-center gap-2 rounded-full border border-orange/25 bg-white/80 px-3 py-1 text-[12.5px] font-semibold text-orange shadow-sm sm:text-[13px]">
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-orange" />
                </span>
                {t.hero.eyebrow}
              </p>
              <h1 className="mt-5 font-display text-[40px] font-bold leading-[1.02] tracking-[-0.02em] text-ink min-[400px]:text-[44px] sm:text-[54px] lg:text-[64px]">
                {t.hero.title}
                <br />
                <span className="bg-gradient-to-r from-[#0A7A4A] to-[#0A6B43] bg-clip-text text-transparent">{t.hero.titleAccent}</span>
              </h1>
              <p className="mt-5 max-w-xl text-[16.5px] leading-relaxed text-muted sm:mt-6 sm:text-lg">{t.hero.body}</p>
              <div id="hero-actions" className="mt-7 grid gap-3 min-[420px]:flex min-[420px]:flex-wrap sm:mt-8">
                <Link href="/inscription" className="btn-primary h-[52px] text-[16px] min-[420px]:h-12 min-[420px]:text-[15px]">
                  {t.hero.primary}
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </Link>
                <a href="#features" className="btn-ghost h-[52px] text-[16px] min-[420px]:h-12 min-[420px]:text-[15px]">{t.hero.secondary}</a>
              </div>
              <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-[13.5px] font-medium text-muted">
                {t.hero.points.map((p) => (
                  <li key={p} className="inline-flex items-center gap-1.5">
                    <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-green-soft text-green-deep">
                      <Check className="h-3 w-3" />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rise relative md:pl-4" style={{ animationDelay: "120ms" }}>
              {/* The sample feed is a teaser that fades out at the bottom, so it never towers over the headline. */}
              <div className="max-h-[430px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_72%,transparent)] md:max-h-[560px] md:[mask-image:linear-gradient(to_bottom,black_80%,transparent)]">
                <MockFeed m={t.mock} />
              </div>
            </div>
          </div>
        </section>

        {/* Who */}
        <section id="who" className="scroll-mt-16 border-y border-line bg-paper py-14 md:py-24">
          <div className="container-x">
            <h2 className="max-w-2xl font-display text-[28px] font-bold leading-[1.1] tracking-tight sm:text-[38px]">{t.who.title}</h2>
            <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-muted sm:text-[17px]">{t.who.body}</p>
            <div className="no-scrollbar -mx-4 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 md:mt-10 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:pb-0">
              {t.who.groups.map((g, i) => {
                const tone = i === 0 ? "text-green-deep bg-green-soft" : i === 1 ? "text-orange bg-orange-soft" : "text-ink bg-paper";
                return (
                  <article key={g.tag} className="w-[84%] flex-none snap-center rounded-3xl border border-line bg-white p-6 shadow-[0_1px_0_rgba(22,24,28,0.04)] min-[480px]:w-[70%] md:w-auto">
                    <span className={`inline-block rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-wide ${tone}`}>{g.tag}</span>
                    <h3 className="mt-4 text-[19px] font-bold leading-snug">{g.title}</h3>
                    <ul className="mt-4 flex flex-col gap-3">
                      {g.points.map((p) => (
                        <li key={p} className="flex gap-3 text-[15px] leading-relaxed text-ink">
                          <span className="mt-1 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-green-soft text-green-deep">
                            <Check className="h-3 w-3" />
                          </span>
                          {p}
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
            <div aria-hidden="true" className="mt-4 flex justify-center gap-1.5 md:hidden">
              {t.who.groups.map((g, i) => <span key={g.tag} className={`h-1.5 rounded-full ${i === 0 ? "w-5 bg-ink/70" : "w-1.5 bg-ink/20"}`} />)}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="container-x scroll-mt-16 py-14 md:py-24">
          <h2 className="max-w-3xl font-display text-[28px] font-bold leading-[1.1] tracking-tight sm:text-[38px]">{t.features.title}</h2>
          <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-muted sm:text-[17px]">{t.features.body}</p>
          <ul className="mt-8 divide-y divide-line overflow-hidden rounded-3xl border border-line sm:mt-10 sm:grid sm:grid-cols-2 sm:gap-x-8 sm:gap-y-9 sm:divide-y-0 sm:overflow-visible sm:rounded-none sm:border-0 lg:grid-cols-4">
            {t.features.items.map((f) => (
              <li key={f.title} className="flex gap-4 bg-white p-5 sm:block sm:p-0">
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-green-soft text-green-deep">
                  <Icon name={f.icon} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[16.5px] font-bold sm:mt-4 sm:text-[17px]">{f.title}</h3>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-muted sm:mt-1.5 sm:text-[15px]">{f.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* How it works */}
        <section id="how" className="relative isolate scroll-mt-16 overflow-hidden bg-ink py-14 text-white md:py-24">
          <div aria-hidden="true" className="absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full bg-[#F07C00]/20 blur-3xl" />
          <div aria-hidden="true" className="absolute -bottom-32 -left-24 -z-10 h-72 w-72 rounded-full bg-[#0A7A4A]/30 blur-3xl" />
          <div className="container-x">
            <h2 className="font-display text-[28px] font-bold leading-[1.1] tracking-tight sm:text-[38px]">{t.how.title}</h2>
            <p className="mt-3 max-w-2xl text-[16px] text-white/70 sm:text-[17px]">{t.how.body}</p>
            <ol className="relative mt-9 grid gap-7 md:mt-10 md:grid-cols-3 md:gap-8">
              <span aria-hidden="true" className="absolute bottom-6 left-[19px] top-6 w-px bg-white/15 md:hidden" />
              {t.how.steps.map((s, i) => (
                <li key={s.title} className="relative flex gap-4 md:block md:border-t md:border-white/20 md:pt-5">
                  <span aria-hidden="true" className="relative z-10 flex h-10 w-10 flex-none items-center justify-center rounded-full bg-orange font-display text-[18px] font-bold text-white md:h-auto md:w-auto md:bg-transparent md:text-[40px] md:leading-none md:text-orange">{i + 1}</span>
                  <div>
                    <h3 className="pt-1.5 text-[18px] font-bold md:mt-3 md:pt-0 md:text-[19px]">
                      <span className="sr-only">{i + 1}. </span>
                      {s.title}
                    </h3>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-white/70 md:mt-2">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-16 py-14 md:py-24">
          <div className="container-x grid gap-8 md:grid-cols-[0.8fr_1.2fr] md:gap-10">
            <h2 className="font-display text-[28px] font-bold leading-[1.1] tracking-tight sm:text-[38px]">{t.faq.title}</h2>
            <div className="divide-y divide-line border-y border-line">
              {t.faq.items.map((item, i) => (
                <details key={item.q} className="group" open={i === 0}>
                  <summary className="tap-row -mx-3 flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-3 py-4 text-[16.5px] font-bold [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span aria-hidden="true" className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-paper text-muted transition-transform duration-200 group-open:rotate-45">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                    </span>
                  </summary>
                  <p className="pb-5 pr-10 text-[15px] leading-relaxed text-muted">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final call to action */}
        <section className="container-x pb-14 md:pb-24">
          <div id="final-cta" className="relative isolate mx-auto max-w-3xl overflow-hidden rounded-[32px] bg-gradient-to-br from-[#0A7A4A] to-[#075437] p-8 text-center text-white shadow-[0_30px_60px_-30px_rgba(10,122,74,0.7)] sm:p-12">
            <div aria-hidden="true" className="absolute -right-16 -top-16 -z-10 h-56 w-56 rounded-full bg-[#F07C00]/30 blur-3xl" />
            <h2 className="font-display text-[27px] font-bold leading-[1.12] tracking-tight sm:text-[36px]">{t.cta.title}</h2>
            <p className="mx-auto mt-3 max-w-xl text-[16px] text-white/80">{t.cta.body}</p>
            <div className="mt-7 grid gap-3 min-[420px]:flex min-[420px]:flex-wrap min-[420px]:justify-center">
              <Link href="/inscription" className="btn h-[52px] bg-white text-[16px] text-[#075437] shadow-sm hover:bg-white/90 active:bg-white/80 min-[420px]:h-12 min-[420px]:text-[15px]">{t.cta.button}</Link>
              <Link href="/connexion" className="btn h-[52px] border border-white/30 text-[16px] text-white hover:bg-white/10 active:bg-white/15 min-[420px]:h-12 min-[420px]:text-[15px]">{t.cta.login}</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-paper pb-24 pt-10 md:pb-10">
        <div className="container-x flex flex-col gap-6 text-[14px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <Wordmark />
            <p>
              {t.footer.madeBy}{" "}
              <a href={site.parent.url} className="font-semibold text-ink underline-offset-4 hover:underline">
                {site.parent.name}
              </a>
              . © {new Date().getFullYear()} {t.footer.rights}
            </p>
          </div>
          <nav aria-label={lang === "fr" ? "Liens du pied de page" : "Footer links"} className="grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:flex-wrap sm:gap-y-2">
            <Link href="/elus" className="hover:text-ink">{t.footer.directory}</Link>
            <Link href="/regles" className="hover:text-ink">{t.footer.rules}</Link>
            <Link href="/confidentialite" className="hover:text-ink">{t.footer.privacy}</Link>
            <Link href={t.nav.switchHref} className="hover:text-ink">{t.nav.switchLabel}</Link>
          </nav>
        </div>
      </footer>

      <LandingCtaBar label={t.hero.primary} login="/connexion" loginLabel={t.nav.login} />
    </div>
  );
}
