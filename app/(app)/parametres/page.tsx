import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/app/components/shell/shell";
import { fetchAuthors, getMyPrivate } from "@/lib/data/people";
import { t as dict } from "@/lib/i18n";
import { createClient, getViewer } from "@/lib/supabase/server";
import type { AccountType, Official, VerificationRequest } from "@/lib/types";
import { LangSwitch } from "@/app/components/lang-switch";
import { AccountSection, PeopleList, PrefsForm, ProfileForm, VerificationForm, VoteForm } from "./settings-forms";

export const metadata: Metadata = { title: "Paramètres", robots: { index: false } };

function Section({ id, title, help, children }: { id: string; title: string; help?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-16 border-b border-line px-4 py-6">
      <h2 className="font-display text-[19px] font-bold">{title}</h2>
      {help && <p className="mt-1 text-[14px] leading-relaxed text-muted">{help}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ badge?: string }> }) {
  const { badge } = await searchParams;
  const viewer = await getViewer();
  if (!viewer) redirect("/connexion");
  const lang = viewer.lang;
  const t = dict(lang);
  const supabase = await createClient();

  const [priv, userRes, verifRes, officialsRes, blocksRes, mutesRes] = await Promise.all([
    getMyPrivate(),
    supabase.auth.getUser(),
    supabase.from("verification_requests").select("*").eq("user_id", viewer.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("officials").select("id, full_name, mandate, title").is("profile_id", null).order("full_name").limit(1000),
    supabase.from("blocks").select("blocked_id").eq("blocker_id", viewer.id).limit(200),
    supabase.from("mutes").select("muted_id").eq("muter_id", viewer.id).limit(200),
  ]);
  const blockedIds = ((blocksRes.data ?? []) as { blocked_id: string }[]).map((r) => r.blocked_id);
  const mutedIds = ((mutesRes.data ?? []) as { muted_id: string }[]).map((r) => r.muted_id);
  const people = await fetchAuthors(supabase, [...blockedIds, ...mutedIds]);
  const pick = (ids: string[]) => ids.map((id) => people.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p)).map((p) => ({ id: p.id, handle: p.handle, display_name: p.display_name, avatar_url: p.avatar_url }));
  const request = (verifRes.data as VerificationRequest | null) ?? null;
  const wanted: AccountType = badge === "institution" || badge === "media" ? badge : "elu";

  return (
    <>
      <PageHeader title={t.settings.title} back="/accueil" />
      <Section id="langue" title={lang === "fr" ? "Langue · Language" : "Language · Langue"} help={lang === "fr" ? "La langue de l'application. Le changement s'applique tout de suite, sur tous vos appareils." : "The app's language. The change applies at once, on all your devices."}>
        <LangSwitch lang={lang} size="md" />
      </Section>
      <Section id="profil" title={t.settings.profile}>
        <ProfileForm viewer={viewer} lang={lang} />
      </Section>
      <Section id="vote" title={t.settings.voting} help={t.settings.votingHelp}>
        <VoteForm
          lang={lang}
          initial={{
            vote_region_id: priv?.vote_region_id ?? null,
            vote_department_id: priv?.vote_department_id ?? null,
            vote_commune_id: priv?.vote_commune_id ?? null,
            vote_locality: priv?.vote_locality ?? "",
            is_registered_voter: priv?.is_registered_voter ?? true,
          }}
        />
      </Section>
      <Section id="preferences" title={t.settings.prefs}>
        <PrefsForm lang={lang} theme={viewer.theme} lowData={viewer.low_data} />
      </Section>
      <Section id="verification" title={t.settings.verification} help={viewer.verified ? undefined : t.settings.verificationIntro}>
        {viewer.verified ? (
          <p className="rounded-2xl bg-green-soft px-4 py-3 text-[14px] font-semibold text-green-deep">{t.settings.approved}</p>
        ) : request?.status === "pending" ? (
          <p className="rounded-2xl bg-orange-soft px-4 py-3 text-[14px] font-semibold text-orange">{t.settings.pending}</p>
        ) : (
          <>
            {request?.status === "rejected" && (
              <p className="mb-4 rounded-2xl bg-paper px-4 py-3 text-[14px] text-muted">
                <b className="text-ink">{t.settings.rejected}.</b> {request.notes}
              </p>
            )}
            <VerificationForm lang={lang} userId={viewer.id} defaultType={wanted} defaultName={viewer.display_name} officials={(officialsRes.data ?? []) as Pick<Official, "id" | "full_name" | "mandate" | "title">[]} />
          </>
        )}
      </Section>
      {(blockedIds.length > 0 || mutedIds.length > 0) && (
        <Section id="comptes" title={`${t.settings.blocked} · ${t.settings.muted}`}>
          <PeopleList lang={lang} blocked={pick(blockedIds)} muted={pick(mutedIds)} />
        </Section>
      )}
      <Section id="compte" title={t.settings.security}>
        <AccountSection lang={lang} email={userRes.data.user?.email ?? ""} handle={viewer.handle} canDelete={Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)} />
      </Section>
    </>
  );
}
