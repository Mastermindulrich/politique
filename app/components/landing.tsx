import Link from "next/link";
import { content, site, type Lang } from "@/lib/content";
import { Check, Icon } from "./icons";
import MockFeed from "./mock-feed";
import WaitlistForm from "./waitlist-form";

function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="flag" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="font-display text-[22px] font-bold tracking-[0.14em] text-ink">POLITIQUE</span>
    </span>
  );
}

export default function Landing({ lang, open = false }: { lang: Lang; open?: boolean }) {
  const t = content[lang];
  // When the beta is open the page leads to the app instead of the waitlist.
  const login = lang === "fr" ? "Se connecter" : "Log in";
  const signup = lang === "fr" ? "Créer un compte" : "Create account";
  const home = lang === "fr" ? "/" : "/en";

  return (
    <div data-theme="light" className="bg-bg text-ink">
      <a href="#waitlist" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white">
        {t.nav.cta}
      </a>

      <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
        <div className="container-x flex h-16 items-center justify-between gap-4">
          <Link href={home} aria-label={`${site.name} — ${lang === "fr" ? "accueil" : "home"}`}>
            <Wordmark />
          </Link>
          <nav aria-label={lang === "fr" ? "Navigation" : "Navigation"} className="hidden items-center gap-7 text-[15px] font-medium text-ink md:flex">
            <a href="#features" className="hover:text-green-deep">{t.nav.features}</a>
            <a href="#who" className="hover:text-green-deep">{t.nav.who}</a>
            <a href="#roadmap" className="hover:text-green-deep">{t.nav.roadmap}</a>
            <a href="#faq" className="hover:text-green-deep">{t.nav.faq}</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href={t.nav.switchHref} hrefLang={lang === "fr" ? "en" : "fr"} className="btn-ghost h-10 px-4 text-[14px]">
              {t.nav.switchLabel}
            </Link>
            {open ? (
              <>
                <Link href="/connexion" className="btn-ghost hidden h-10 px-4 text-[14px] sm:inline-flex">{login}</Link>
                <Link href="/inscription" className="btn-primary h-10 px-4 text-[14px]">{signup}</Link>
              </>
            ) : (
              <a href="#waitlist" className="btn-primary hidden h-10 px-4 text-[14px] sm:inline-flex">
                {t.nav.cta}
              </a>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="container-x grid items-center gap-12 py-14 md:grid-cols-[1.1fr_0.9fr] md:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-orange/30 bg-orange-soft px-3 py-1 text-[13px] font-semibold text-orange">
              <span className="h-2 w-2 rounded-full bg-orange" aria-hidden="true" />
              {t.hero.eyebrow}
            </p>
            <h1 className="mt-5 font-display text-[40px] font-bold leading-[1.05] tracking-tight text-ink sm:text-[52px] lg:text-[60px]">
              {t.hero.title}
              <br />
              <span className="text-green-deep">{t.hero.titleAccent}</span>
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-muted sm:text-lg">{t.hero.body}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {open ? <Link href="/inscription" className="btn-primary">{signup}</Link> : <a href="#waitlist" className="btn-primary">{t.hero.primary}</a>}
              <a href="#features" className="btn-ghost">{t.hero.secondary}</a>
            </div>
            <p className="mt-4 text-[14px] text-muted">{t.hero.note}</p>
          </div>
          <div className="md:pl-4">
            <MockFeed m={t.mock} />
          </div>
        </section>

        {/* Who */}
        <section id="who" className="border-y border-line bg-paper py-16 md:py-24">
          <div className="container-x">
            <h2 className="max-w-2xl font-display text-[30px] font-bold leading-tight tracking-tight sm:text-[38px]">{t.who.title}</h2>
            <p className="mt-3 max-w-2xl text-[17px] text-muted">{t.who.body}</p>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {t.who.groups.map((g, i) => {
                const tone = i === 0 ? "text-green-deep bg-green-soft" : i === 1 ? "text-orange bg-orange-soft" : "text-muted bg-white border border-line";
                return (
                  <article key={g.tag} className="rounded-3xl border border-line bg-white p-6">
                    <span className={`inline-block rounded-full px-3 py-1 text-[12px] font-bold uppercase tracking-wide ${tone}`}>{g.tag}</span>
                    <h3 className="mt-4 text-[20px] font-bold leading-snug">{g.title}</h3>
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
          </div>
        </section>

        {/* Features */}
        <section id="features" className="container-x py-16 md:py-24">
          <h2 className="max-w-3xl font-display text-[30px] font-bold leading-tight tracking-tight sm:text-[38px]">{t.features.title}</h2>
          <p className="mt-3 max-w-2xl text-[17px] text-muted">{t.features.body}</p>
          <ul className="mt-10 grid gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
            {t.features.items.map((f) => (
              <li key={f.title}>
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-soft text-green-deep">
                  <Icon name={f.icon} />
                </span>
                <h3 className="mt-4 text-[17px] font-bold">{f.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{f.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Roadmap */}
        <section id="roadmap" className="border-y border-line bg-ink py-16 text-white md:py-24">
          <div className="container-x">
            <h2 className="font-display text-[30px] font-bold leading-tight tracking-tight sm:text-[38px]">{t.roadmap.title}</h2>
            <p className="mt-3 max-w-2xl text-[17px] text-white/70">{t.roadmap.body}</p>
            <ol className="mt-10 grid gap-6 md:grid-cols-4">
              {t.roadmap.steps.map((s, i) => (
                <li key={s.title} className="relative border-t border-white/20 pt-5">
                  <span
                    aria-hidden="true"
                    className={`absolute -top-[5px] left-0 h-[9px] w-[9px] rounded-full ${s.state === "now" ? "bg-orange" : "bg-white/40"}`}
                  />
                  <div className={`text-[13px] font-semibold uppercase tracking-wide ${s.state === "now" ? "text-orange" : "text-white/60"}`}>
                    {s.when}
                  </div>
                  <h3 className="mt-2 text-[19px] font-bold">
                    <span className="sr-only">{i + 1}. </span>
                    {s.title}
                  </h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-white/70">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Waitlist */}
        <section id="waitlist" className="container-x py-16 md:py-24">
          <div className="mx-auto max-w-2xl rounded-[32px] border border-line bg-paper p-6 sm:p-10">
            <h2 className="font-display text-[28px] font-bold leading-tight tracking-tight sm:text-[34px]">{t.cta.title}</h2>
            <p className="mt-3 text-[16px] text-muted">{t.cta.body}</p>
            <div className="mt-6">
              <WaitlistForm t={t.form} lang={lang} id="wl" />
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-line py-16 md:py-24">
          <div className="container-x grid gap-10 md:grid-cols-[0.8fr_1.2fr]">
            <h2 className="font-display text-[30px] font-bold leading-tight tracking-tight sm:text-[38px]">{t.faq.title}</h2>
            <dl className="divide-y divide-line">
              {t.faq.items.map((item) => (
                <div key={item.q} className="py-5 first:pt-0">
                  <dt className="text-[17px] font-bold">{item.q}</dt>
                  <dd className="mt-2 text-[15px] leading-relaxed text-muted">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-paper py-10">
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
          <div className="flex gap-6">
            <Link href={t.nav.switchHref} className="hover:text-ink">{t.nav.switchLabel}</Link>
            <a href={`${site.parent.url}/privacy`} className="hover:text-ink">{t.footer.privacy}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
