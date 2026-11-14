/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text */
import { ImageResponse } from "next/og";
import { Avatar, BrandBar, Frame, SiteCard, VerifiedCheck, clip, formatCount, imageData, muted, ogFonts, ogSize } from "@/lib/og";
import { brand } from "@/lib/brand";
import { createPublicClient } from "@/lib/supabase/server";
import { content } from "@/lib/content";
import type { Profile } from "@/lib/types";

export const alt = "Profil sur POLITIQUE";
export const size = ogSize;
export const contentType = "image/png";
export const revalidate = 3600;

const types = { citoyen: "Citoyen", elu: "Élu", institution: "Institution", media: "Média" } as const;

/** The member's card: banner, picture, name, type and audience. Never shows where they vote. */
export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const fonts = await ogFonts();
  const h = decodeURIComponent(handle).toLowerCase();
  const { data } = /^[a-z0-9_]{3,20}$/.test(h)
    ? await createPublicClient().from("profiles").select("display_name, handle, bio, avatar_url, banner_url, account_type, verified, followers_count, posts_count, suspended_until").eq("handle", h).maybeSingle()
    : { data: null };
  const p = data as Pick<Profile, "display_name" | "handle" | "bio" | "avatar_url" | "banner_url" | "account_type" | "verified" | "followers_count" | "posts_count" | "suspended_until"> | null;
  if (!p || (p.suspended_until && new Date(p.suspended_until) > new Date())) {
    const c = content.fr;
    return new ImageResponse(<SiteCard title={c.hero.title} accent={c.hero.titleAccent} body="Le réseau social politique de la Côte d'Ivoire" />, { ...size, fonts });
  }
  const [avatar, banner] = await Promise.all([imageData(p.avatar_url), imageData(p.banner_url)]);
  return new ImageResponse(
    (
      <Frame>
        {banner ? (
          <div style={{ position: "absolute", left: 0, top: 0, width: 1200, height: 630, display: "flex" }}>
            <img src={banner} width={1200} height={630} style={{ objectFit: "cover", opacity: 0.35 }} />
            <div style={{ position: "absolute", left: 0, top: 0, width: 1200, height: 630, display: "flex", backgroundImage: "linear-gradient(180deg, rgba(15,17,19,.35) 0%, rgba(15,17,19,.95) 70%)" }} />
          </div>
        ) : null}
        <BrandBar size={44} />
        <div style={{ display: "flex", alignItems: "flex-end", gap: 36, marginTop: "auto" }}>
          <Avatar src={avatar} name={p.display_name} size={190} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 8, maxWidth: 820 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ fontFamily: "Space Grotesk", fontWeight: 700, fontSize: 62, letterSpacing: -1 }}>{clip(p.display_name, 26)}</div>
              {p.verified ? <VerifiedCheck size={44} /> : null}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28, color: muted }}>
              <span>@{p.handle}</span>
              <span style={{ fontSize: 22, fontWeight: 600, color: brand.orange, border: `2px solid ${brand.orange}`, borderRadius: 30, padding: "4px 16px" }}>{types[p.account_type] ?? "Membre"}</span>
            </div>
          </div>
        </div>
        {p.bio ? <div style={{ display: "flex", fontSize: 28, lineHeight: 1.4, marginTop: 28, maxWidth: 1000, color: "#E3E5E8" }}>{clip(p.bio, 150)}</div> : null}
        <div style={{ display: "flex", gap: 34, marginTop: 24, fontSize: 26, color: muted }}>
          <span><b style={{ color: "#fff", fontWeight: 600, marginRight: 8 }}>{formatCount(p.followers_count)}</b> abonnés</span>
          <span><b style={{ color: "#fff", fontWeight: 600, marginRight: 8 }}>{formatCount(p.posts_count)}</b> publications</span>
        </div>
      </Frame>
    ),
    { ...size, fonts },
  );
}
