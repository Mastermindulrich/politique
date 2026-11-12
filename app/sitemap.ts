import type { MetadataRoute } from "next";
import { site } from "@/lib/content";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${site.origin}/`, lastModified: now, alternates: { languages: { fr: `${site.origin}/`, en: `${site.origin}/en` } } },
    { url: `${site.origin}/en`, lastModified: now, alternates: { languages: { fr: `${site.origin}/`, en: `${site.origin}/en` } } },
  ];
}
