import { ImageResponse } from "next/og";
import { Avatar, BrandBar, Frame, SiteCard, VerifiedCheck, clip, imageData, muted, ogFonts, ogSize } from "@/lib/og";
import { brand } from "@/lib/brand";
import * as geo from "@/lib/ci-geo";
import { attachProfiles, officialPlace } from "@/lib/data/people";
import { t as dict } from "@/lib/i18n";
import { createPublicClient } from "@/lib/supabase/server";
import { content } from "@/lib/content";
import type { Official } from "@/lib/types";

export const alt = "Fiche d'un élu sur POLITIQUE";
export const size = ogSize;
export const contentType = "image/png";
export const revalidate = 3600;

/** An official's card: who they are, what mandate, where, and an invitation to ask them a question. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fonts = await ogFonts();
  const supabase = createPublicClient();
  const { data } = /^[0-9a-f-]{36}$/.test(id) ? await supabase.from("officials").select("*").eq("id", id).maybeSingle() : { data: null };
  const [o] = data ? await attachProfiles(supabase, [data as Official]).catch(() => [data as Official]) : [];
  if (!o) {
    const c = content.fr;
    return new ImageResponse(<SiteCard title={c.hero.title} accent={c.hero.titleAccent} body="Le réseau social politique de la Côte d'Ivoire" />, { ...size, fonts });
  }
  const photo = await imageData(o.photo_url ?? o.profile?.avatar_url);
  const mandate = o.title || dict("fr").officials.mandates[o.mandate];
  return new ImageResponse(
    (
      <Frame>
        <BrandBar size={44} />
        <div style={{ display: "flex", alignItems: "center", gap: 40, marginTop: "auto", marginBottom: "auto" }}>
          <Avatar src={photo} name={o.full_name} size={210} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 780 }}>
            <div style={{ display: "flex", fontSize: 24, fontWeight: 600, letterSpacing: 3, color: brand.orange }}>{clip(mandate, 50).toUpperCase()}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ fontFamily: "Space Grotesk", fontWeight: 700, fontSize: 62, lineHeight: 1.05, letterSpacing: -1 }}>{clip(o.full_name, 40)}</div>
              {o.profile?.verified ? <VerifiedCheck size={44} /> : null}
            </div>
            <div style={{ display: "flex", fontSize: 30, color: muted }}>{clip(officialPlace(o, geo), 60)}</div>
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 26, fontWeight: 600, color: "#E3E5E8" }}>Interpellations, promesses et permanences sur POLITIQUE</div>
      </Frame>
    ),
    { ...size, fonts },
  );
}
