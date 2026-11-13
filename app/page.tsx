import type { Metadata } from "next";
import Landing from "./components/landing";
import { content } from "@/lib/content";
import { getViewer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: { absolute: content.fr.meta.title },
  description: content.fr.meta.description,
  alternates: { canonical: "/", languages: { fr: "/", en: "/en" } },
  openGraph: { title: content.fr.meta.title, description: content.fr.meta.description, url: "/" },
};

export default async function Page() {
  // Signed-in people go straight to their feed.
  if (await getViewer()) redirect("/accueil");
  return <Landing lang="fr" />;
}
