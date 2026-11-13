"use client";

import { useRouter } from "next/navigation";
import { Composer } from "@/app/components/composer";

export function HomeComposer({ lang, defaultCommuneId }: { lang: "fr" | "en"; defaultCommuneId: number | null }) {
  const router = useRouter();
  return <Composer lang={lang} defaultCommuneId={defaultCommuneId} compact onPosted={() => router.refresh()} />;
}
