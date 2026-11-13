import type { Metadata } from "next";
import Landing from "../components/landing";
import { content } from "@/lib/content";
import { getViewer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: { absolute: content.en.meta.title },
  description: content.en.meta.description,
  alternates: { canonical: "/en", languages: { fr: "/", en: "/en" } },
  openGraph: { title: content.en.meta.title, description: content.en.meta.description, url: "/en", locale: "en_US" },
};

export default async function Page() {
  // Signed-in people go straight to their feed.
  if (await getViewer()) redirect("/accueil");
  return <Landing lang="en" />;
}
