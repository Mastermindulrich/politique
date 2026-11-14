import type { Metadata } from "next";
import Landing from "../components/landing";
import { content } from "@/lib/content";

export const metadata: Metadata = {
  title: { absolute: content.en.meta.title },
  description: content.en.meta.description,
  alternates: { canonical: "/en", languages: { fr: "/", en: "/en" } },
  openGraph: { title: content.en.meta.title, description: content.en.meta.description, url: "/en", locale: "en_US" },
};

// Static, served from the edge. Signed-in people are sent to their feed by the middleware.
export default function Page() {
  return <Landing lang="en" />;
}
