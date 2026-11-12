import type { Metadata } from "next";
import Landing from "./components/landing";
import { content } from "@/lib/content";

export const metadata: Metadata = {
  title: { absolute: content.fr.meta.title },
  description: content.fr.meta.description,
  alternates: { canonical: "/", languages: { fr: "/", en: "/en" } },
  openGraph: { title: content.fr.meta.title, description: content.fr.meta.description, url: "/" },
};

export default function Page() {
  return <Landing lang="fr" />;
}
