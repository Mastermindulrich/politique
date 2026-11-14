"use client";
import { I } from "@/app/components/ui/icons";
import { formatDuration } from "@/lib/dm-media";
import { t as dict } from "@/lib/i18n";
import { LIVE_BARS, type useVoiceRecorder } from "@/lib/voice-recorder";

type Voice = ReturnType<typeof useVoiceRecorder>;

/**
 * Recording a voice message, in the same pill as the message box (X style):
 * delete on the left; inside the pill pause/resume, the live waveform scrolling with the
 * voice (tall bars for loud syllables, dots for silences), the timer and start over; send on the right.
 */
export function VoicePanel({ voice, lang, onCancel, onSend }: { voice: Voice; lang: "fr" | "en"; onCancel: () => void; onSend: () => void }) {
  const t = dict(lang);
  const isPaused = voice.state === "paused";
  const ready = voice.state === "recording" || isPaused;
  // Right-aligned: dots on the left fill with bars as the recording grows.
  const bars = [...Array(Math.max(0, LIVE_BARS - voice.live.length)).fill(-1), ...voice.live];

  return (
    <div className="dock-sheet flex w-full items-center gap-2" role="group" aria-label={t.messages.recording}>
      <button type="button" aria-label={t.messages.cancelVoice} onClick={onCancel} className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-full bg-paper text-ink ring-1 ring-line transition hover:text-orange active:scale-90">
        <I.trash className="h-[22px] w-[22px]" />
      </button>

      <div className="flex h-[46px] min-w-0 flex-1 items-center gap-2 rounded-[24px] border border-line bg-paper pl-1.5 pr-1">
        <button
          type="button"
          aria-label={isPaused ? t.messages.resumeRec : t.messages.pauseRec}
          onClick={isPaused ? voice.resume : voice.pause}
          disabled={!ready}
          className={`flex h-9 w-9 flex-none items-center justify-center rounded-full transition active:scale-90 disabled:opacity-40 ${isPaused ? "bg-red-500 text-white" : "bg-ink text-bg"}`}
        >
          {isPaused ? (
            <I.mic className="h-[18px] w-[18px]" />
          ) : (
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.2" /><rect x="14" y="5" width="4" height="14" rx="1.2" /></svg>
          )}
        </button>

        <span className="flex h-8 min-w-0 flex-1 items-center justify-end gap-[2px] overflow-hidden" aria-hidden="true">
          {bars.map((v, i) =>
            v < 0 ? (
              <span key={i} className="h-[3px] w-[3px] flex-none rounded-full bg-muted/40" />
            ) : (
              <span
                key={i}
                className={`w-[3px] flex-none rounded-full transition-[height] duration-75 ${isPaused ? "bg-muted" : "bg-green"}`}
                style={{ height: `${Math.max(10, Math.round(v * 100))}%` }}
              />
            ),
          )}
        </span>

        <span className="flex flex-none items-center gap-1.5 pl-1 text-[15px] font-semibold tabular-nums text-ink">
          {!isPaused && <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" aria-hidden="true" />}
          {formatDuration(voice.seconds)}
        </span>

        <button type="button" aria-label={t.messages.restartRec} title={t.messages.restartRec} onClick={() => void voice.restart().catch(() => onCancel())} disabled={!ready} className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-muted transition hover:bg-bg hover:text-ink active:scale-90 disabled:opacity-40">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 12a8.5 8.5 0 1 0 2.8-6.3" /><path d="M3.5 4.5v4.5H8" /></svg>
        </button>
      </div>

      <button type="button" aria-label={t.messages.stopSend} onClick={onSend} disabled={!ready} className="send-pop flex h-[46px] w-[46px] flex-none items-center justify-center rounded-full bg-green text-white shadow-sm transition active:scale-90 disabled:opacity-50">
        <I.send className="h-5 w-5 -translate-x-px translate-y-px" />
      </button>
    </div>
  );
}
