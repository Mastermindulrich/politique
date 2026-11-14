"use client";

import { callText } from "@/lib/call-i18n";
import type { Peer } from "@/lib/call-actions";
import { useCalls } from "./call-provider";
import { CallIcons } from "./call-screen";

/** Phone and camera buttons in a one-to-one conversation's header. Hidden when calls are off. */
export function CallButtons({ conversationId, peer, lang }: { conversationId: string; peer: Peer; lang: "fr" | "en" }) {
  const { enabled, busy, call } = useCalls();
  if (!enabled) return null;
  const t = callText(lang);
  const cls = "flex h-10 w-10 items-center justify-center rounded-full text-green-deep transition hover:bg-green-soft active:scale-95 disabled:opacity-40";
  return (
    <div className="ml-auto flex flex-none items-center gap-1">
      <button type="button" aria-label={`${t.voiceCall} : ${peer.display_name}`} title={t.voiceCall} disabled={busy} onClick={() => call(conversationId, false, peer)} className={cls}>
        <CallIcons.phoneOutline className="h-[22px] w-[22px]" />
      </button>
      <button type="button" aria-label={`${t.videoCall} : ${peer.display_name}`} title={t.videoCall} disabled={busy} onClick={() => call(conversationId, true, peer)} className={cls}>
        <CallIcons.video className="h-6 w-6" />
      </button>
    </div>
  );
}
