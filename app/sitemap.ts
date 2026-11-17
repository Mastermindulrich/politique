import type { MetadataRoute } from "next";
import { site } from "@/lib/content";
import { library } from "@/lib/library";
import { showcases } from "@/lib/communes";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${site.origin}/`, lastModified: now, alternates: { languages: { fr: `${site.origin}/`, en: `${site.origin}/en` } } },
    { url: `${site.origin}/en`, lastModified: now, alternates: { languages: { fr: `${site.origin}/`, en: `${site.origin}/en` } } },
    { url: `${site.origin}/elus`, lastModified: now },
    { url: `${site.origin}/bibliotheque`, lastModified: now },
    { url: `${site.origin}/decouvertes`, lastModified: now },
    ...showcases.map((s) => ({ url: `${site.origin}/decouvertes/${s.slug}`, lastModified: now })),
    ...library.map((e) => ({ url: `${site.origin}/bibliotheque/${e.id}`, lastModified: now })),
  ];
}
