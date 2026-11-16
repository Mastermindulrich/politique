"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { answerIce, endRing, ringAgain, startCall, type Peer } from "@/lib/call-actions";
import { callText } from "@/lib/call-i18n";
import { AUDIO_CONSTRAINTS, CallSession, VIDEO_CONSTRAINTS, callsSupported, newDeviceId, type Sig } from "@/lib/call-session";
import { supabaseBrowser } from "@/lib/supabase/client";
import { CallScreen } from "./call-screen";
import { playHangupTone, setAudioMode, startRingback, startRingtone, unlockAudio } from "./tones";

/**
 * Voice and video calls for the whole app. Mounted once in the app layout, so a call keeps going
 * while the member moves between pages, and an incoming call rings on any page.
 *
 * Ringing: the server broadcasts "ring" on the member's private inbox topic (see lib/calls.ts),
 * plus a push notification for phones where the app is closed. Everything after that happens on the
 * call's own channel (lib/call-session.ts). Nothing is stored.
 */

export type Phase = "idle" | "outgoing" | "incoming" | "connecting" | "active" | "ended";
export type EndReason = "ended" | "declined" | "busy" | "noAnswer" | "failed" | "unavailable" | "blocked" | "micDenied" | "noDevice" | "unsupported" | "answeredElsewhere";

export type CallView = {
  phase: Phase;
  peer: Peer | null;
  video: boolean;
  role: "caller" | "callee";
  startedAt: number | null;
  reason: EndReason | null;
  micOn: boolean;
  camOn: boolean;
  facing: "user" | "environment";
  remoteCam: boolean;
  remoteMic: boolean;
  reconnecting: boolean;
  conversationId: string | null;
};

type Ring = { call_id: string; conversation_id: string; video: boolean; from: Peer; at: number };

type Ctx = { enabled: boolean; busy: boolean; call: (conversationId: string, video: boolean, peer: Peer) => void };
const CallContext = createContext<Ctx>({ enabled: false, busy: false, call: () => {} });
export const useCalls = () => useContext(CallContext);

const RING_TIMEOUT = 45_000;
const RING_EVERY = 4_000;
const IDLE: CallView = { phase: "idle", peer: null, video: false, role: "caller", startedAt: null, reason: null, micOn: true, camOn: false, facing: "user", remoteCam: false, remoteMic: true, reconnecting: false, conversationId: null };

function mediaError(e: unknown): EndReason {
  const name = (e as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return "micDenied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "noDevice";
  return "failed";
}

export function CallProvider({ viewerId, inbox, enabled, lang, children }: { viewerId: string; inbox: string; enabled: boolean; lang: "fr" | "en"; children: React.ReactNode }) {
  const [view, setView] = useState<CallView>(IDLE);
  const [supported, setSupported] = useState(false);
  const local = useRef<MediaStream | null>(null);
  const remote = useRef<MediaStream | null>(null);
  const [streams, setStreams] = useState<{ local: MediaStream | null; remote: MediaStream | null }>({ local: null, remote: null });
  const session = useRef<CallSession | null>(null);
  const callRef = useRef<{ id: string; conversationId: string; video: boolean; role: "caller" | "callee"; ice?: RTCIceServer[] } | null>(null);
  // The latest state, readable at once from event handlers (React state lags one render behind).
  const viewRef = useRef(view);
  const apply = useCallback((next: CallView | ((v: CallView) => CallView)) => {
    const v = typeof next === "function" ? next(viewRef.current) : next;
    viewRef.current = v;
    setView(v);
  }, []);
  const deviceId = useRef<string>("");
  const stopSound = useRef<(() => void) | null>(null);
  const timers = useRef<number[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);
  const failTimer = useRef<number | null>(null);

  useEffect(() => {
    deviceId.current = newDeviceId();
    setSupported(callsSupported());
    // Phones only allow sound after a tap. Unlock it on the first tap anywhere in the app,
    // so a call that arrives later can actually ring.
    const unlock = () => {
      unlockAudio();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // iPhone: ring even with the silent switch on (like a phone call), then switch to call audio.
  useEffect(() => {
    setAudioMode(view.phase === "incoming" ? "ring" : view.phase === "idle" ? "auto" : "call");
  }, [view.phase]);

  const patch = useCallback((p: Partial<CallView>) => apply((v) => ({ ...v, ...p })), [apply]);

  const silence = useCallback(() => {
    stopSound.current?.();
    stopSound.current = null;
  }, []);

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => {
      window.clearTimeout(id);
      window.clearInterval(id);
    });
    timers.current = [];
    if (failTimer.current) window.clearTimeout(failTimer.current);
    failTimer.current = null;
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const every = useCallback((fn: () => void, ms: number) => {
    const id = window.setInterval(fn, ms);
    // Stored with the timeouts; clearTimeout and clearInterval share ids in browsers.
    timers.current.push(id);
  }, []);

  /** Tears everything down and shows why for a moment (or closes at once with no reason). */
  const finish = useCallback((reason: EndReason | null, sendHangup = true) => {
    silence();
    clearTimers();
    session.current?.close(sendHangup);
    session.current = null;
    local.current?.getTracks().forEach((t) => t.stop());
    local.current = null;
    remote.current = null;
    setStreams({ local: null, remote: null });
    void wakeLock.current?.release().catch(() => {});
    wakeLock.current = null;
    const wasLive = viewRef.current.phase !== "idle";
    callRef.current = null;
    if (!reason || !wasLive) {
      apply(IDLE);
      return;
    }
    if (reason !== "answeredElsewhere") playHangupTone();
    apply((v) => ({ ...v, phase: "ended", reason, reconnecting: false }));
    window.setTimeout(() => apply((v) => (v.phase === "ended" ? IDLE : v)), 2200);
  }, [apply, clearTimers, silence]);

  const keepAwake = useCallback(async () => {
    try {
      const nav = navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
      wakeLock.current = (await nav.wakeLock?.request("screen")) ?? null;
    } catch {
      // not supported or refused: the call still works
    }
  }, []);

  async function getMedia(video: boolean) {
    const s = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS, video: video ? { ...VIDEO_CONSTRAINTS, facingMode: "user" } : false });
    local.current = s;
    setStreams((x) => ({ ...x, local: s }));
    return s;
  }

  const onConnection = useCallback((state: RTCPeerConnectionState) => {
    if (state === "connected") {
      if (failTimer.current) window.clearTimeout(failTimer.current);
      failTimer.current = null;
      apply((v) => ({ ...v, phase: "active", reconnecting: false, startedAt: v.startedAt ?? Date.now() }));
      // Tell the other side our mic/camera state now that they surely hear us.
      session.current?.send("media", { mic: viewRef.current.micOn, cam: viewRef.current.camOn }, session.current.peerDevice);
      void keepAwake();
    } else if (state === "disconnected" || state === "failed") {
      patch({ reconnecting: true });
      if (state === "failed") session.current?.restart();
      // Give the network a moment (lift, tunnel, Wi-Fi to 4G) before asking for a new path, then give up.
      if (!failTimer.current) {
        const s = session.current;
        failTimer.current = window.setTimeout(() => s?.restart(), 4000);
        later(() => {
          if (session.current === s && viewRef.current.reconnecting) finish("failed");
        }, 25_000);
      }
    }
  }, [apply, finish, keepAwake, later, patch]);

  const handlers = useCallback((s: () => CallSession | null) => ({
    onRemoteTrack: (stream: MediaStream) => {
      remote.current = stream;
      setStreams((x) => ({ ...x, remote: stream }));
    },
    onConnection,
    onSignal: (sig: Sig) => {
      const me = s();
      const call = callRef.current;
      if (!me || !call || me !== session.current) return;
      if (call.role === "caller") {
        // Only the device that answered may talk to us after "accept".
        if (sig.k === "accept") {
          if (me.peerDevice) {
            // Our "taken" got lost: say it again to the device we are talking to.
            if (sig.f === me.peerDevice) me.send("taken", undefined, sig.f);
            return;
          }
          me.peerDevice = sig.f;
          me.send("taken", undefined, sig.f);
          silence();
          clearTimers();
          patch({ phase: "connecting" });
          if (local.current && call.ice) me.connect(call.ice, local.current, "caller");
          // Until the call connects, repeat our offer and candidates every few seconds (lost broadcasts).
          let n = 0;
          const nudge = () => {
            if (session.current !== me || viewRef.current.phase !== "connecting") return;
            if (n++ >= 8) return finish("failed");
            me.resend();
            later(nudge, 3000);
          };
          later(nudge, 3000);
          return;
        }
        if (me.peerDevice && sig.f !== me.peerDevice) return;
        if (!me.peerDevice && (sig.k === "decline" || sig.k === "busy")) {
          void endRing(call.id, call.conversationId, false);
          finish(sig.k === "decline" ? "declined" : "busy", false);
          return;
        }
      } else {
        if (sig.k === "taken") {
          if (sig.t !== me.deviceId) finish("answeredElsewhere", false);
          else me.peerDevice = sig.f;
          return;
        }
        if (sig.k === "cancel") {
          finish(null, false);
          return;
        }
      }
      if (sig.k === "hangup") finish("ended", false);
      else if (sig.k === "media") {
        const d = sig.d as { mic?: boolean; cam?: boolean };
        patch({ remoteMic: d.mic !== false, remoteCam: Boolean(d.cam) });
      }
    },
  }), [clearTimers, finish, later, onConnection, patch, silence]);

  // ---- outgoing ----
  const call = useCallback(async (conversationId: string, video: boolean, peer: Peer) => {
    if (viewRef.current.phase !== "idle" || !enabled) return;
    unlockAudio();
    apply({ ...IDLE, phase: "outgoing", peer, video, role: "caller", camOn: video, remoteCam: video, conversationId });
    if (!callsSupported()) return finish("unsupported", false);
    let stream: MediaStream;
    try {
      stream = await getMedia(video);
    } catch (e) {
      return finish(mediaError(e), false);
    }
    const phase = () => viewRef.current.phase as Phase;
    if (phase() !== "outgoing") {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    const r = await startCall(conversationId, video).catch(() => null);
    if (!r || !r.ok) {
      const err = r && !r.ok ? r.error : "failed";
      return finish(err === "blocked" ? "blocked" : err === "unavailable" ? "unavailable" : "failed", false);
    }
    if (phase() !== "outgoing") {
      // Hung up while we were setting up.
      stream.getTracks().forEach((t) => t.stop());
      void endRing(r.callId, conversationId, true);
      return;
    }
    callRef.current = { id: r.callId, conversationId, video, role: "caller", ice: r.ice };
    patch({ peer: r.peer });
    const s: CallSession = new CallSession(r.callId, viewerId, deviceId.current, handlers(() => s));
    session.current = s;
    try {
      await s.join();
    } catch {
      return finish("failed", false);
    }
    if (session.current !== s) return;
    s.send("media", { mic: true, cam: video });
    stopSound.current = startRingback();
    // Ring again every 4 s; every 8 s the notification is sent again too, so a locked phone keeps buzzing.
    let rings = 0;
    every(() => {
      if (!s.peerDevice && session.current === s) void ringAgain(r.callId, conversationId, video, ++rings % 2 === 0);
    }, RING_EVERY);
    later(() => {
      if (session.current === s && !s.peerDevice) {
        s.send("cancel");
        void endRing(r.callId, conversationId, true);
        finish("noAnswer", false);
      }
    }, RING_TIMEOUT);
  }, [apply, enabled, every, finish, handlers, later, patch, viewerId]);

  // ---- incoming ----
  useEffect(() => {
    if (!enabled || !inbox) return;
    const supabase = supabaseBrowser();
    const ch = supabase
      .channel(inbox, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "ring" }, ({ payload }: { payload: Ring }) => {
        if (!payload?.call_id || payload.from?.id === viewerId) return;
        if (seen.current.has(payload.call_id)) return;
        seen.current.add(payload.call_id);
        // Already on a call: say so, without disturbing the current one.
        if (viewRef.current.phase !== "idle" || !callsSupported()) {
          const busy = new CallSession(payload.call_id, viewerId, deviceId.current, { onSignal: () => {}, onRemoteTrack: () => {}, onConnection: () => {} });
          void busy.join().then(() => busy.send("busy")).catch(() => {}).finally(() => window.setTimeout(() => busy.close(false), 600));
          return;
        }
        callRef.current = { id: payload.call_id, conversationId: payload.conversation_id, video: Boolean(payload.video), role: "callee" };
        apply({ ...IDLE, phase: "incoming", peer: payload.from, video: Boolean(payload.video), role: "callee", camOn: Boolean(payload.video), remoteCam: Boolean(payload.video), conversationId: payload.conversation_id });
        const s: CallSession = new CallSession(payload.call_id, viewerId, deviceId.current, handlers(() => s));
        session.current = s;
        void s.join().catch(() => {});
        stopSound.current = startRingtone();
        later(() => {
          if (session.current === s && viewRef.current.phase === "incoming") finish(null, false);
        }, RING_TIMEOUT + 5000);
      })
      .on("broadcast", { event: "cancel" }, ({ payload }: { payload: { call_id?: string } }) => {
        if (payload?.call_id && callRef.current?.id === payload.call_id && viewRef.current.phase === "incoming") finish(null, false);
        if (payload?.call_id) seen.current.add(payload.call_id);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [apply, enabled, finish, handlers, inbox, later, viewerId]);

  const accept = useCallback(async () => {
    const call = callRef.current;
    const s = session.current;
    if (!call || !s || viewRef.current.phase !== "incoming") return;
    unlockAudio();
    silence();
    patch({ phase: "connecting" });
    let stream: MediaStream;
    try {
      stream = await getMedia(call.video);
    } catch (e) {
      s.send("decline");
      return finish(mediaError(e), false);
    }
    const r = await answerIce(call.conversationId).catch(() => null);
    if (!r || !r.ok) {
      s.send("decline");
      return finish("unavailable", false);
    }
    if (session.current !== s) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    s.connect(r.ice, stream, "callee");
    s.send("media", { mic: true, cam: call.video });
    // Say "accept" until the caller's offer comes back (a broadcast can get lost on a weak network).
    let tries = 0;
    const sendAccept = () => {
      if (session.current !== s || viewRef.current.phase !== "connecting" || s.peerDevice) return;
      if (tries++ > 6) return finish("failed");
      s.send("accept");
      later(sendAccept, 1500);
    };
    sendAccept();
  }, [finish, later, patch, silence]);

  const decline = useCallback(() => {
    session.current?.send("decline");
    finish(null, false);
  }, [finish]);

  const hangup = useCallback(() => {
    const call = callRef.current;
    const s = session.current;
    if (call?.role === "caller" && s && !s.peerDevice) {
      s.send("cancel");
      void endRing(call.id, call.conversationId, true);
      return finish("ended", false);
    }
    finish("ended", true);
  }, [finish]);

  const toggleMic = useCallback(() => {
    const track = local.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    patch({ micOn: track.enabled });
    session.current?.send("media", { mic: track.enabled, cam: viewRef.current.camOn });
  }, [patch]);

  const setCamera = useCallback(async (on: boolean, facing: "user" | "environment" = viewRef.current.facing) => {
    const s = session.current;
    const stream = local.current;
    if (!stream) return;
    for (const old of stream.getVideoTracks()) {
      old.stop();
      stream.removeTrack(old);
    }
    let track: MediaStreamTrack | null = null;
    if (on) {
      try {
        const v = await navigator.mediaDevices.getUserMedia({ video: { ...VIDEO_CONSTRAINTS, facingMode: facing } });
        track = v.getVideoTracks()[0] ?? null;
      } catch {
        track = null;
      }
      if (track) stream.addTrack(track);
    }
    await s?.setVideoTrack(track);
    // A fresh MediaStream object makes the preview pick up the new track everywhere.
    setStreams((x) => ({ ...x, local: new MediaStream(stream.getTracks()) }));
    patch({ camOn: Boolean(track), facing });
    s?.send("media", { mic: viewRef.current.micOn, cam: Boolean(track) });
  }, [patch]);

  const toggleCam = useCallback(() => void setCamera(!viewRef.current.camOn), [setCamera]);
  const flip = useCallback(() => void setCamera(true, viewRef.current.facing === "user" ? "environment" : "user"), [setCamera]);

  // Leaving or reloading the page ends the call properly for the other person.
  useEffect(() => {
    const bye = () => {
      if (viewRef.current.phase === "idle" || viewRef.current.phase === "ended") return;
      const call = callRef.current;
      if (call?.role === "caller" && !session.current?.peerDevice) session.current?.send("cancel");
      else if (viewRef.current.phase === "incoming") return;
      else session.current?.send("hangup");
    };
    window.addEventListener("pagehide", bye);
    return () => window.removeEventListener("pagehide", bye);
  }, []);

  const t = callText(lang);
  return (
    <CallContext.Provider value={{ enabled: enabled && supported, busy: view.phase !== "idle", call: (c, v, p) => void call(c, v, p) }}>
      {children}
      {view.phase !== "idle" && (
        <CallScreen view={view} local={streams.local} remote={streams.remote} t={t} lang={lang} onAccept={() => void accept()} onDecline={decline} onHangup={hangup} onMic={toggleMic} onCam={toggleCam} onFlip={flip} />
      )}
    </CallContext.Provider>
  );
}
