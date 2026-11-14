"use client";
import { I } from "@/app/components/ui/icons";
import { formatDuration } from "@/lib/dm-media";
import { t as dict } from "@/lib/i18n";
import { LIVE_BARS, type useVoiceRecorder } from "@/lib/voice-recorder";

type Voice = ReturnType<typeof useVoiceRecorder>;

/**
 * Recording a voice message: a live waveform that scrolls from right to left with the voice
 * (tall bars for loud syllables, short ones for silences), the timer, and the controls:
 * delete, start over, pause / resume, send.
 */
export function VoicePanel({ voice, lang, onCancel, onSend }: { voice: Voice; lang: "fr" | "en"; onCancel: () => void; onSend: () => void }) {
  const t = dict(lang);
  const isPaused = voice.state === "paused";
  const ready = voice.state === "recording" || isPaused;
  // Right-aligned: empty slots on the left fill up as the recording grows.
  const bars = [...Array(Math.max(0, LIVE_BARS - voice.live.length)).fill(-1), ...voice.live];

  return (
    <div className="flex w-full flex-col gap-2" role="group" aria-label={t.messages.recording}>
      <div className="flex h-12 items-center gap-3 rounded-3xl border border-line bg-paper px-4">
        {isPaused ? (
          <span className="h-3 w-3 flex-none rounded-full bg-muted" aria-hidden="true" />
        ) : (
          <span className="relative flex h-3 w-3 flex-none" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
          </span>
        )}
        <span className="w-11 flex-none text-[16px] font-semibold tabular-nums">{formatDuration(voice.seconds)}</span>
        <span className="flex h-9 min-w-0 flex-1 items-center justify-end gap-[2px] overflow-hidden" aria-hidden="true">
          {bars.map((v, i) =>
            v < 0 ? (
              <span key={i} className="h-[3px] w-[3px] flex-none rounded-full bg-ink/15" />
            ) : (
              <span
                key={i}
                className={`w-[3px] flex-none rounded-full ${isPaused ? "bg-muted" : i >= bars.length - 3 ? "bg-red-500" : "bg-green"}`}
                style={{ height: `${Math.max(8, Math.round(v * 100))}%` }}
              />
            ),
          )}
        </span>
        {isPaused && <span className="flex-none text-[12px] font-semibold uppercase tracking-wide text-muted">{t.messages.paused}</span>}
      </div>
      <div className="flex items-center justify-between px-1">
        <button type="button" aria-label={t.messages.cancelVoice} onClick={onCancel} className="flex h-11 w-11 items-center justify-center rounded-full text-orange hover:bg-paper">
          <I.trash className="h-6 w-6" />
        </button>
        <button type="button" aria-label={t.messages.restartRec} onClick={() => void voice.restart().catch(() => onCancel())} disabled={!ready} className="flex h-11 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold text-ink hover:bg-paper disabled:opacity-40">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>
          {t.messages.restartRec}
        </button>
        <button
          type="button"
          aria-label={isPaused ? t.messages.resumeRec : t.messages.pauseRec}
          onClick={isPaused ? voice.resume : voice.pause}
          disabled={!ready}
          className={`flex h-12 w-12 items-center justify-center rounded-full border-2 disabled:opacity-40 ${isPaused ? "border-red-500 text-red-500" : "border-line text-ink"}`}
        >
          {isPaused ? (
            <I.mic className="h-6 w-6" />
          ) : (
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
          )}
        </button>
        <button type="button" aria-label={t.messages.stopSend} onClick={onSend} disabled={!ready} className="btn-primary h-11 w-11 !px-0">
          <I.send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
