"use client";
// Voice notes for direct messages: record from the microphone with MediaRecorder,
// sample the loudness for a waveform, and hand back an audio Blob.
import { useCallback, useEffect, useRef, useState } from "react";

export const VOICE_MAX_SECONDS = 5 * 60;
const PEAKS = 48;

/** First format this browser can record that every other browser can also play. */
function pickMime() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const m of ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/aac", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return "";
}

export function voiceSupported() {
  return typeof window !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";
}

export type VoiceNote = { blob: Blob; mime: string; duration: number; peaks: number[] };

/** Squeeze any number of loudness samples into `n` bars scaled 8-100. */
function bars(samples: number[], n = PEAKS) {
  if (!samples.length) return Array(n).fill(8);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.floor((i * samples.length) / n), b = Math.max(a + 1, Math.floor(((i + 1) * samples.length) / n));
    out.push(Math.max(...samples.slice(a, b)));
  }
  const top = Math.max(...out, 0.01);
  return out.map((v) => Math.max(8, Math.min(100, Math.round((v / top) * 100))));
}

/** How many bars the live waveform shows while recording (newest on the right). */
export const LIVE_BARS = 64;

/** `onLimit` gets the note when recording stops by itself at the time limit. */
export function useVoiceRecorder(onLimit?: (note: VoiceNote) => void) {
  const [state, setState] = useState<"idle" | "starting" | "recording" | "paused">("idle");
  const [seconds, setSeconds] = useState(0);
  /** Recent loudness, 0-1, one value per 80 ms: drawn as the scrolling live waveform. */
  const [live, setLive] = useState<number[]>([]);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const samples = useRef<number[]>([]);
  /** Recorded time before the current run (pauses excluded), and when the current run began. */
  const banked = useRef(0);
  const runStart = useRef(0);
  const paused = useRef(false);
  const timer = useRef<number | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const finish = useRef<((v: VoiceNote | null) => void) | null>(null);
  const limitCb = useRef(onLimit);
  limitCb.current = onLimit;

  const elapsed = useCallback(() => banked.current + (paused.current || !runStart.current ? 0 : (Date.now() - runStart.current) / 1000), []);

  const cleanup = useCallback(() => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void ctx.current?.close().catch(() => {});
    ctx.current = null;
    rec.current = null;
    banked.current = 0;
    runStart.current = 0;
    paused.current = false;
    setState("idle");
    setSeconds(0);
    setLive([]);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  /** Ask for the microphone and start. Throws "denied" or "unsupported". */
  const start = useCallback(async () => {
    if (!voiceSupported()) throw new Error("unsupported");
    setState("starting");
    let s: MediaStream;
    try {
      s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      setState("idle");
      throw new Error("denied");
    }
    stream.current = s;
    const mime = pickMime();
    const r = mime ? new MediaRecorder(s, { mimeType: mime, audioBitsPerSecond: 48000 }) : new MediaRecorder(s);
    chunks.current = [];
    samples.current = [];
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    r.onstop = () => {
      const type = (r.mimeType || mime || "audio/webm").split(";")[0];
      const duration = elapsed();
      const blob = new Blob(chunks.current, { type });
      const done = finish.current;
      finish.current = null;
      const peaks = bars(samples.current);
      cleanup();
      const note = blob.size ? { blob, mime: type, duration, peaks } : null;
      if (done) done(note);
      else if (note) limitCb.current?.(note);
    };
    // Loudness, ~12 times a second: the live waveform and the one stored with the note.
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ac = new AC();
      ctx.current = ac;
      const an = ac.createAnalyser();
      an.fftSize = 1024;
      ac.createMediaStreamSource(s).connect(an);
      const buf = new Uint8Array(an.fftSize);
      const tick = () => {
        if (!ctx.current) return;
        if (!paused.current) {
          an.getByteTimeDomainData(buf);
          // Peak of the window, so syllables show as sharp highs and silences as lows.
          let sum = 0, peak = 0;
          for (const v of buf) {
            const x = Math.abs(v - 128) / 128;
            sum += x * x;
            if (x > peak) peak = x;
          }
          const rms = Math.sqrt(sum / buf.length);
          const loud = Math.min(1, Math.pow(rms * 0.6 + peak * 0.4, 0.6) * 1.6);
          samples.current.push(rms);
          setLive((l) => (l.length >= LIVE_BARS ? [...l.slice(l.length - LIVE_BARS + 1), loud] : [...l, loud]));
        }
        window.setTimeout(tick, 80);
      };
      tick();
    } catch {
      /* the waveform is a nicety */
    }
    r.start(1000);
    rec.current = r;
    banked.current = 0;
    runStart.current = Date.now();
    paused.current = false;
    setState("recording");
    timer.current = window.setInterval(() => {
      const sec = elapsed();
      setSeconds(sec);
      if (sec >= VOICE_MAX_SECONDS && rec.current && rec.current.state !== "inactive") rec.current.stop();
    }, 200);
  }, [cleanup, elapsed]);

  const pause = useCallback(() => {
    const r = rec.current;
    if (!r || r.state !== "recording") return;
    r.pause();
    banked.current = elapsed();
    paused.current = true;
    setSeconds(banked.current);
    setState("paused");
  }, [elapsed]);

  const resume = useCallback(() => {
    const r = rec.current;
    if (!r || r.state !== "paused") return;
    r.resume();
    runStart.current = Date.now();
    paused.current = false;
    setState("recording");
  }, []);

  /** Stop and get the note (null when nothing was recorded). */
  const stop = useCallback(
    () =>
      new Promise<VoiceNote | null>((resolve) => {
        const r = rec.current;
        if (!r || r.state === "inactive") {
          cleanup();
          return resolve(null);
        }
        finish.current = resolve;
        r.stop();
      }),
    [cleanup],
  );

  const cancel = useCallback(() => {
    finish.current = null;
    const r = rec.current;
    if (r && r.state !== "inactive") {
      r.onstop = () => cleanup();
      r.stop();
    } else cleanup();
  }, [cleanup]);

  /** Throw away what was recorded and start again from 0:00. */
  const restart = useCallback(async () => {
    finish.current = null;
    const r = rec.current;
    if (r && r.state !== "inactive") {
      await new Promise<void>((ok) => {
        r.onstop = () => { cleanup(); ok(); };
        r.stop();
      });
    } else cleanup();
    await start();
  }, [cleanup, start]);

  return { state, seconds, live, start, stop, cancel, pause, resume, restart };
}
