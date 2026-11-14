"use client";

/**
 * Ringtone (incoming) and ringback (outgoing) made with Web Audio: no file to download.
 * Browsers only allow sound after the page has been touched once; vibration covers Android phones then.
 */
let ctx: AudioContext | null = null;

function audio() {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!ctx) ctx = new Ctx();
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  return ctx;
}

function tone(freqs: number[], start: number, length: number, gain = 0.12) {
  const c = audio();
  if (!c) return;
  const g = c.createGain();
  g.connect(c.destination);
  const t0 = c.currentTime + start;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.02);
  g.gain.setValueAtTime(gain, t0 + length - 0.05);
  g.gain.linearRampToValueAtTime(0, t0 + length);
  for (const f of freqs) {
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    o.connect(g);
    o.start(t0);
    o.stop(t0 + length + 0.02);
  }
}

/** Plays a pattern now and every `every` ms until the returned function is called. */
function loop(play: () => void, every: number, vibrate?: number[]) {
  play();
  if (vibrate) navigator.vibrate?.(vibrate);
  const id = window.setInterval(() => {
    play();
    if (vibrate) navigator.vibrate?.(vibrate);
  }, every);
  return () => {
    window.clearInterval(id);
    if (vibrate) navigator.vibrate?.(0);
  };
}

/** A bright three-note phrase, twice, every 3 seconds. */
export function startRingtone() {
  return loop(() => {
    const notes = [659.25, 783.99, 987.77];
    notes.forEach((f, i) => tone([f], i * 0.16, 0.15, 0.14));
    notes.forEach((f, i) => tone([f], 0.7 + i * 0.16, 0.15, 0.14));
  }, 3000, [400, 200, 400]);
}

/** The classic "it's ringing on their side" tone: 425 Hz, 1 s on, 4 s off. */
export function startRingback() {
  return loop(() => tone([425], 0, 1, 0.06), 5000);
}

/** Short falling beep when a call ends. */
export function playHangupTone() {
  tone([480], 0, 0.18, 0.08);
  tone([380], 0.22, 0.25, 0.08);
}

/** Call it from a tap so later sounds are allowed (iPhone). */
export function unlockAudio() {
  audio();
}
