import { site } from "@/lib/content";

export type Doc = { title: string; updated: string; intro: string; sections: { h: string; p?: string[]; ul?: string[] }[] };

/** Renders a rules or policy document: one heading per section, short paragraphs, plain lists. */
export function DocPage({ doc, lang }: { doc: Doc; lang: "fr" | "en" }) {
  return (
    <article>
      <h1 className="font-display text-[32px] font-bold leading-tight sm:text-[38px]">{doc.title}</h1>
      <p className="mt-2 text-[14px] text-muted">{doc.updated}</p>
      <p className="mt-6 text-[17px] leading-relaxed">{doc.intro}</p>
      {doc.sections.map((s) => (
        <section key={s.h} className="mt-9">
          <h2 className="font-display text-[21px] font-bold">{s.h}</h2>
          {s.p?.map((p) => <p key={p} className="mt-3 text-[16px] leading-relaxed text-ink">{p}</p>)}
          {s.ul && (
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-[16px] leading-relaxed">
              {s.ul.map((li) => <li key={li}>{li}</li>)}
            </ul>
          )}
        </section>
      ))}
      <section className="mt-9 rounded-2xl bg-paper px-5 py-4 text-[15px] leading-relaxed">
        <b>{lang === "fr" ? "Nous écrire" : "Contact us"}</b>
        <br />
        {site.contact ? (
          <a href={`mailto:${site.contact}`} className="font-semibold text-green-deep hover:underline">{site.contact}</a>
        ) : (
          <a href={site.parent.url} className="font-semibold text-green-deep hover:underline">{site.parent.url.replace("https://", "")}</a>
        )}
      </section>
    </article>
  );
}
