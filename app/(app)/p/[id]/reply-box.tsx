"use client";

import { useRouter } from "next/navigation";
import { Composer } from "@/app/components/composer";

export function ReplyBox({ lang, parentId, replyTo }: { lang: "fr" | "en"; parentId: string; replyTo: string }) {
  const router = useRouter();
  return <Composer lang={lang} parentId={parentId} replyTo={replyTo} compact onPosted={() => router.refresh()} />;
}
