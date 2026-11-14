import { ImageResponse } from "next/og";
import { SiteCard, ogFonts, ogSize } from "@/lib/og";
import { content } from "@/lib/content";

export const alt = "POLITIQUE — Côte d'Ivoire's political social network";
export const size = ogSize;
export const contentType = "image/png";

export default async function Image() {
  const c = content.en;
  return new ImageResponse(<SiteCard title={c.hero.title} accent={c.hero.titleAccent} body="Côte d'Ivoire's political social network" />, { ...size, fonts: await ogFonts() });
}
