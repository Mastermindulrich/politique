"use client";
import { t as dict } from "@/lib/i18n";

/**
 * The other person's "…" bubble, like iMessage and WhatsApp: three dots that rise in turn,
 * or a small pulsing mic when they are recording a voice note. Groups also show who.
 */
export function TypingBubble({ names, voice, lang }: { names: string[]; voice: boolean; lang: "fr" | "en" }) {
  const t = dict(lang);
  const who = names.length ? names.join(", ") + " " : "";
  const label = `${who}${voice ? t.messages.recordingVoice : t.messages.typing}`;
  return (
    <div className="mt-1.5 flex flex-col items-start" role="status" aria-live="polite">
      {names.length > 0 && <span className="mb-0.5 ml-3 text-[12px] text-muted">{label}</span>}
      <div className="typing-bubble flex h-9 items-center gap-1.5 rounded-3xl rounded-bl-md bg-paper px-4" aria-label={label} title={label}>
        {voice ? (
          <>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 animate-pulse text-red-500" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0" /><path d="M12 17.5V21" /></svg>
            <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
          </>
        ) : (
          <>
            <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
          </>
        )}
        <span className="sr-only">{label}</span>
      </div>
    </div>
  );
}
