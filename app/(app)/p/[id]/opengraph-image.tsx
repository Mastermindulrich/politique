import { ImageResponse } from "next/og";
import { Avatar, BrandBar, Frame, SiteCard, VerifiedCheck, clip, formatCount, imageData, muted, ogFonts, ogSize } from "@/lib/og";
import { fetchPost } from "@/lib/data/posts";
import { createPublicClient } from "@/lib/supabase/server";
import { content } from "@/lib/content";

export const alt = "Publication sur POLITIQUE";
export const size = ogSize;
export const contentType = "image/png";
export const revalidate = 3600;

const types = { citoyen: "Citoyen", elu: "Élu", institution: "Institution", media: "Média" } as const;

/** The post as a card: who said it, what they said, and how much it is being discussed. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fonts = await ogFonts();
  const post = /^[0-9a-f-]{36}$/.test(id) ? await fetchPost(createPublicClient(), id, null).catch(() => null) : null;
  if (!post || post.deleted_at || !post.text?.trim()) {
    const c = content.fr;
    return new ImageResponse(<SiteCard title={c.hero.title} accent={c.hero.titleAccent} body="Le réseau social politique de la Côte d'Ivoire" />, { ...size, fonts });
  }
  const a = post.author;
  const avatar = await imageData(a.avatar_url);
  const text = clip(post.text, 260);
  const fontSize = text.length <= 90 ? 54 : text.length <= 170 ? 44 : 36;
  const stats = [
    post.like_count ? `${formatCount(post.like_count)} J'aime` : null,
    post.reply_count ? `${formatCount(post.reply_count)} réponse${post.reply_count > 1 ? "s" : ""}` : null,
    post.repost_count ? `${formatCount(post.repost_count)} republication${post.repost_count > 1 ? "s" : ""}` : null,
  ].filter(Boolean);
  return new ImageResponse(
    (
      <Frame>
        <BrandBar size={44} />
        <div style={{ display: "flex", alignItems: "center", gap: 22, marginTop: 50 }}>
          <Avatar src={avatar} name={a.display_name} size={92} />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontFamily: "Space Grotesk", fontWeight: 700, fontSize: 40 }}>{clip(a.display_name, 34)}</div>
              {a.verified ? <VerifiedCheck /> : null}
            </div>
            <div style={{ fontSize: 26, color: muted }}>{`@${a.handle} · ${types[a.account_type] ?? ""}`}</div>
          </div>
        </div>
        <div style={{ display: "flex", fontSize, lineHeight: 1.3, marginTop: 34, maxWidth: 1000, fontWeight: 400 }}>{text}</div>
        <div style={{ display: "flex", marginTop: "auto", fontSize: 24, fontWeight: 600, color: muted }}>{stats.join("   ·   ") || "Rejoignez le débat sur POLITIQUE"}</div>
      </Frame>
    ),
    { ...size, fonts },
  );
}
