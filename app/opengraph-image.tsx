import { ImageResponse } from "next/og";
import { SiteCard, ogFonts, ogSize } from "@/lib/og";
import { content } from "@/lib/content";

export const alt = "POLITIQUE — Le réseau social politique de la Côte d'Ivoire";
export const size = ogSize;
export const contentType = "image/png";

export default async function Image() {
  const c = content.fr;
  return new ImageResponse(<SiteCard title={c.hero.title} accent={c.hero.titleAccent} body="Le réseau social politique de la Côte d'Ivoire" />, { ...size, fonts: await ogFonts() });
}
