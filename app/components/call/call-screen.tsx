"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/app/components/ui/avatar";
import type { CallDict } from "@/lib/call-i18n";
import type { CallView } from "./call-provider";

type P = { className?: string };
const svg = (p: P, children: React.ReactNode) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={p.className ?? "h-6 w-6"}>
    {children}
  </svg>
);
const phonePath = "M6.6 3.5h2.3l1.4 4-1.9 1.3a12 12 0 0 0 6.8 6.8l1.3-1.9 4 1.4v2.3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z";
export const CallIcons = {
  phone: (p: P) => svg(p, <path d={phonePath} fill="currentColor" stroke="none" />),
  phoneOutline: (p: P) => svg(p, <path d={phonePath} />),
  hangup: (p: P) => svg(p, <path d={phonePath} fill="currentColor" stroke="none" transform="rotate(135 12 12)" />),
  video: (p: P) => svg(p, <><rect x="2.5" y="6" width="13" height="12" rx="2.5" /><path d="m15.5 10.5 6-3.5v10l-6-3.5z" /></>),
  videoOff: (p: P) => svg(p, <><path d="M10 6h3a2.5 2.5 0 0 1 2.5 2.5v1.5l6-3.5v10l-2-1.2" /><path d="M15.5 15.5A2.5 2.5 0 0 1 13 18H5a2.5 2.5 0 0 1-2.5-2.5v-7A2.5 2.5 0 0 1 5 6" /><path d="m3 3 18 18" /></>),
  mic: (p: P) => svg(p, <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0" /><path d="M12 17.5V21" /></>),
  micOff: (p: P) => svg(p, <><path d="M15 10V6a3 3 0 0 0-5.7-1.3" /><path d="M9 9v2a3 3 0 0 0 4.6 2.5" /><path d="M18.5 11a6.5 6.5 0 0 1-.9 3.3M5.5 11a6.5 6.5 0 0 0 10.4 5.2" /><path d="M12 17.5V21" /><path d="m3 3 18 18" /></>),
  flip: (p: P) => svg(p, <><path d="M4 8.5V7a2 2 0 0 1 2-2h2l1.5-2h5L16 5h2a2 2 0 0 1 2 2v1.5" /><path d="M20 15.5V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.5" /><path d="m7 12-3-3.5L1 12" /><path d="m17 12 3 3.5 3-3.5" /></>),
};

function useTimer(start: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!start) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [start]);
  if (!start) return null;
  const s = Math.max(0, Math.floor((now - start) / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Plays a MediaStream in a <video> or <audio>, keeping srcObject in sync. */
function useStream<T extends HTMLMediaElement>(stream: MediaStream | null, tick: unknown) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    if (stream) void el.play().catch(() => {});
  }, [stream, tick]);
  return ref;
}

function Round({ label, onClick, tone = "glass", children, big = false }: { label: string; onClick: () => void; tone?: "glass" | "on" | "red" | "green"; children: React.ReactNode; big?: boolean }) {
  const colors = {
    glass: "bg-white/15 text-white hover:bg-white/25",
    on: "bg-white text-[#16181C]",
    red: "bg-[#E5484D] text-white hover:bg-[#d63c41]",
    green: "bg-green text-white hover:brightness-110",
  }[tone];
  return (
    <span className="flex flex-col items-center gap-1.5">
      <button type="button" aria-label={label} title={label} onClick={onClick} className={`flex items-center justify-center rounded-full backdrop-blur-md transition active:scale-95 ${big ? "h-[68px] w-[68px]" : "h-14 w-14"} ${colors}`}>
        {children}
      </button>
      <span className="max-w-[84px] text-center text-[12px] leading-tight text-white/80">{label}</span>
    </span>
  );
}

/**
 * The call screen: full screen on phones, a large dark panel on computers.
 * Incoming: who is calling, Decline / Answer. Outgoing and live: the other person's video (or their
 * photo for a voice call), my own preview in a corner, and the controls.
 */
export function CallScreen({ view, local, remote, t, onAccept, onDecline, onHangup, onMic, onCam, onFlip }: {
  view: CallView; local: MediaStream | null; remote: MediaStream | null; t: CallDict; lang: "fr" | "en";
  onAccept: () => void; onDecline: () => void; onHangup: () => void; onMic: () => void; onCam: () => void; onFlip: () => void;
}) {
  const timer = useTimer(view.phase === "active" ? view.startedAt : null);
  const remoteTick = remote?.getTracks().map((x) => x.id).join() ?? "";
  const remoteVideo = useStream<HTMLVideoElement>(remote, remoteTick);
  const remoteAudio = useStream<HTMLAudioElement>(remote, remoteTick);
  const localVideo = useStream<HTMLVideoElement>(local, local?.getVideoTracks()[0]?.id);
  const [touch, setTouch] = useState(false);
  useEffect(() => setTouch(window.matchMedia("(pointer: coarse)").matches), []);

  // Lock the page behind the call (phones scroll otherwise).
  useEffect(() => {
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = before;
    };
  }, []);

  const peer = view.peer;
  const showRemoteVideo = view.remoteCam && Boolean(remote?.getVideoTracks().length) && (view.phase === "active" || view.phase === "connecting");
  const showLocalVideo = view.camOn && Boolean(local?.getVideoTracks().length);
  const status =
    view.phase === "ended" ? (view.reason ? t[view.reason === "ended" ? "ended" : view.reason] : t.ended)
    : view.phase === "incoming" ? (view.video ? t.incomingVideo : t.incomingVoice)
    : view.phase === "outgoing" ? t.ringing
    : view.phase === "connecting" ? t.connecting
    : view.reconnecting ? t.reconnecting
    : timer ?? "";

  return (
    <div role="dialog" aria-modal="true" aria-label={view.video ? t.videoCall : t.voiceCall} className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 sm:p-6">
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0E1012] text-white sm:h-[min(820px,92vh)] sm:max-w-[480px] sm:rounded-[28px] sm:shadow-2xl">
        {/* Background: their video, or a soft blurred version of their photo. */}
        {/* Always mounted (hidden when unused) so the stream is attached the moment their camera comes on. */}
        <video ref={remoteVideo} autoPlay playsInline muted className={`absolute inset-0 h-full w-full bg-black object-cover ${showRemoteVideo ? "" : "hidden"}`} />
        {!showRemoteVideo && (
          <>
            {peer?.avatar_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={peer.avatar_url} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-35 blur-3xl" />
            )}
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-[#0A7A4A]/35 via-transparent to-black/70" />
          </>
        )}
        {/* Sound always goes through its own element so it plays even with video hidden. */}
        <audio ref={remoteAudio} autoPlay playsInline className="hidden" />

        {/* Who and status */}
        <div className={`relative z-10 flex flex-col items-center px-6 text-center ${showRemoteVideo ? "bg-gradient-to-b from-black/60 to-transparent pb-8 pt-[max(env(safe-area-inset-top),16px)]" : "flex-1 justify-center pt-[max(env(safe-area-inset-top),24px)]"}`}>
          {!showRemoteVideo && peer && (
            <span className="relative mb-5 rounded-full">
              {(view.phase === "incoming" || view.phase === "outgoing") && <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-white/15 [animation-duration:1.8s]" />}
              <Avatar src={peer.avatar_url} name={peer.display_name} size={112} className="ring-4 ring-white/10" />
            </span>
          )}
          <p className={`font-display font-bold leading-tight ${showRemoteVideo ? "text-[20px]" : "text-[28px]"}`}>{peer?.display_name ?? ""}</p>
          <p className="mt-1.5 text-[15px] tabular-nums text-white/75" aria-live="polite">{status}</p>
          {view.phase === "active" && (!view.remoteMic || (view.video && !view.remoteCam)) && (
            <p className="mt-2 flex items-center gap-2 rounded-full bg-black/35 px-3 py-1 text-[13px] text-white/85">
              {!view.remoteMic && <><CallIcons.micOff className="h-4 w-4" />{t.mutedRemote}</>}
              {view.video && !view.remoteCam && view.remoteMic && <><CallIcons.videoOff className="h-4 w-4" />{t.camOffRemote}</>}
            </p>
          )}
        </div>
        {showRemoteVideo && <div className="flex-1" />}

        {/* My own camera, mirrored like a mirror for the front camera. */}
        {(
          <video
            ref={localVideo}
            autoPlay
            playsInline
            muted
            aria-label={t.you}
            className={`absolute right-4 z-20 w-[104px] ${showLocalVideo && view.phase !== "ended" ? "" : "hidden"} rounded-2xl border border-white/20 bg-black object-cover shadow-xl sm:w-[132px] ${showRemoteVideo ? "top-[max(env(safe-area-inset-top),16px)]" : "bottom-[calc(env(safe-area-inset-bottom)+150px)]"} ${view.facing === "user" ? "-scale-x-100" : ""}`}
            style={{ aspectRatio: "3 / 4" }}
          />
        )}

        {/* Controls */}
        <div className="relative z-10 bg-gradient-to-t from-black/70 to-transparent px-6 pb-[max(env(safe-area-inset-bottom),24px)] pt-10">
          {view.phase === "incoming" ? (
            <div className="flex items-start justify-around">
              <Round label={t.decline} onClick={onDecline} tone="red" big><CallIcons.hangup className="h-8 w-8" /></Round>
              <Round label={t.accept} onClick={onAccept} tone="green" big>
                {view.video ? <CallIcons.video className="h-8 w-8" /> : <CallIcons.phone className="h-8 w-8" />}
              </Round>
            </div>
          ) : view.phase === "ended" ? (
            <div className="h-[92px]" />
          ) : (
            <div className="flex items-start justify-center gap-5">
              <Round label={view.micOn ? t.mute : t.unmute} onClick={onMic} tone={view.micOn ? "glass" : "on"}>
                {view.micOn ? <CallIcons.mic /> : <CallIcons.micOff />}
              </Round>
              <Round label={view.camOn ? t.camOff : t.camOn} onClick={onCam} tone={view.camOn ? "glass" : "on"}>
                {view.camOn ? <CallIcons.video /> : <CallIcons.videoOff />}
              </Round>
              {touch && view.camOn && (
                <Round label={t.flip} onClick={onFlip}><CallIcons.flip /></Round>
              )}
              <Round label={t.hangup} onClick={onHangup} tone="red"><CallIcons.hangup className="h-7 w-7" /></Round>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
