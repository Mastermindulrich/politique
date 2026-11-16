"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * One call between two phones: the WebRTC connection plus its signalling channel.
 *
 * - Signalling: Supabase Realtime broadcast on `call-<callId>`. The call id is a random UUID
 *   known only to the two members, and nothing is stored.
 * - Media: relay-only (iceTransportPolicy "relay"), through Cloudflare TURN. Phones never connect
 *   directly, so neither side learns the other's IP address.
 * - Negotiation: "perfect negotiation" (the callee is the polite side). The caller sets up one audio
 *   and one video slot from the start, so turning the camera on later is a track swap, not a new offer.
 */

export type SigKind = "accept" | "taken" | "decline" | "busy" | "cancel" | "hangup" | "desc" | "cand" | "media";
export type Sig = { k: SigKind; f: string; t?: string; u: string; d?: unknown };

/** Video kept small on purpose: looks sharp on a phone and keeps relay data (and cost) low. */
export const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 640, max: 1280 },
  height: { ideal: 480, max: 720 },
  frameRate: { ideal: 24, max: 30 },
};
const VIDEO_MAX_BITRATE = 600_000;
export const AUDIO_CONSTRAINTS: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

export function callsSupported() {
  return typeof window !== "undefined" && typeof RTCPeerConnection !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

export const newDeviceId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

type Handlers = {
  onSignal: (s: Sig) => void;
  onRemoteTrack: (stream: MediaStream) => void;
  onConnection: (state: RTCPeerConnectionState) => void;
};

export class CallSession {
  readonly callId: string;
  readonly deviceId: string;
  readonly userId: string;
  private channel: RealtimeChannel | null = null;
  private pc: RTCPeerConnection | null = null;
  private polite = false;
  private makingOffer = false;
  private ignoreOffer = false;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  /** Our own candidates, kept so they can be sent again if a broadcast was lost. */
  private sentCandidates: RTCIceCandidateInit[] = [];
  private audioTx: RTCRtpTransceiver | null = null;
  private videoTx: RTCRtpTransceiver | null = null;
  /** Where signalling goes: the device that answered (caller side) or the caller's device (callee side). */
  peerDevice: string | null = null;
  readonly remote = new MediaStream();
  private h: Handlers;
  private closed = false;

  constructor(callId: string, userId: string, deviceId: string, h: Handlers) {
    this.callId = callId;
    this.userId = userId;
    this.deviceId = deviceId;
    this.h = h;
  }

  /** Joins the call's signalling channel; resolves once messages can be sent. */
  join(): Promise<void> {
    const supabase = supabaseBrowser();
    return new Promise((resolve, reject) => {
      const ch = supabase.channel(`call-${this.callId}`, { config: { broadcast: { self: false, ack: false } } });
      ch.on("broadcast", { event: "sig" }, ({ payload }: { payload: Sig }) => {
        if (!payload || payload.f === this.deviceId) return;
        if (payload.t && payload.t !== this.deviceId) {
          // Addressed to another of this member's devices; only "taken" matters to us (stop ringing).
          if (payload.k === "taken") this.h.onSignal(payload);
          return;
        }
        if (payload.k === "desc") void this.onDescription(payload.d as RTCSessionDescriptionInit);
        else if (payload.k === "cand") void this.onCandidate(payload.d as RTCIceCandidateInit | null);
        this.h.onSignal(payload);
      });
      const timer = window.setTimeout(() => reject(new Error("join-timeout")), 10_000);
      ch.subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          window.clearTimeout(timer);
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          window.clearTimeout(timer);
          reject(new Error(status));
        }
      });
      this.channel = ch;
    });
  }

  send(k: SigKind, d?: unknown, to?: string | null) {
    if (!this.channel || this.closed && k !== "hangup") return;
    const payload: Sig = { k, f: this.deviceId, u: this.userId };
    if (to) payload.t = to;
    if (d !== undefined) payload.d = d;
    void this.channel.send({ type: "broadcast", event: "sig", payload });
  }

  /**
   * Opens the relay-only connection. The caller (impolite) adds both media slots and makes the offer;
   * the callee (polite) waits for it and fills the slots the offer creates.
   */
  connect(ice: RTCIceServer[], local: MediaStream, role: "caller" | "callee") {
    this.polite = role === "callee";
    const pc = new RTCPeerConnection({ iceServers: ice, iceTransportPolicy: "relay", bundlePolicy: "max-bundle" });
    this.pc = pc;
    pc.ontrack = (e) => {
      if (!this.remote.getTracks().includes(e.track)) {
        for (const old of this.remote.getTracks().filter((x) => x.kind === e.track.kind)) this.remote.removeTrack(old);
        this.remote.addTrack(e.track);
      }
      this.h.onRemoteTrack(this.remote);
    };
    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      const c = e.candidate.toJSON();
      this.sentCandidates.push(c);
      this.send("cand", c, this.peerDevice);
    };
    pc.onconnectionstatechange = () => this.h.onConnection(pc.connectionState);
    pc.onnegotiationneeded = async () => {
      if (this.polite) return; // only the caller starts offers; the callee answers
      try {
        this.makingOffer = true;
        await pc.setLocalDescription();
        this.send("desc", pc.localDescription?.toJSON(), this.peerDevice);
      } catch (e) {
        console.error("offer failed", e);
      } finally {
        this.makingOffer = false;
      }
    };
    if (role === "caller") {
      const a = local.getAudioTracks()[0] ?? null;
      const v = local.getVideoTracks()[0] ?? null;
      this.audioTx = pc.addTransceiver(a ?? "audio", { direction: "sendrecv", streams: [local] });
      this.videoTx = pc.addTransceiver(v ?? "video", { direction: "sendrecv", streams: [local] });
      void this.capVideo();
    }
    this.localForAnswer = local;
  }

  private localForAnswer: MediaStream | null = null;

  private async capVideo() {
    const sender = this.videoTx?.sender;
    if (!sender) return;
    try {
      const p = sender.getParameters();
      if (!p.encodings || !p.encodings.length) p.encodings = [{}];
      p.encodings[0].maxBitrate = VIDEO_MAX_BITRATE;
      await sender.setParameters(p);
    } catch {
      // Some browsers refuse before negotiation; the browser's own limits apply then.
    }
  }

  private async onDescription(desc: RTCSessionDescriptionInit) {
    const pc = this.pc;
    if (!pc || !desc) return;
    try {
      const collision = desc.type === "offer" && (this.makingOffer || pc.signalingState !== "stable");
      this.ignoreOffer = !this.polite && collision;
      if (this.ignoreOffer) return;
      await pc.setRemoteDescription(desc);
      for (const c of this.pendingCandidates.splice(0)) await pc.addIceCandidate(c).catch(() => {});
      if (desc.type === "offer") {
        if (this.polite && !this.audioTx) this.fillSlots();
        await pc.setLocalDescription();
        this.send("desc", pc.localDescription?.toJSON(), this.peerDevice);
        // A repeated offer means the caller may have missed our earlier messages.
        for (const c of this.sentCandidates) this.send("cand", c, this.peerDevice);
      }
    } catch (e) {
      console.error("description failed", e);
    }
  }

  /** Callee: put our microphone and camera in the slots the caller's offer created. */
  private fillSlots() {
    const pc = this.pc;
    const local = this.localForAnswer;
    if (!pc || !local) return;
    for (const tx of pc.getTransceivers()) {
      const kind = tx.receiver.track?.kind;
      if (kind === "audio" && !this.audioTx) this.audioTx = tx;
      if (kind === "video" && !this.videoTx) this.videoTx = tx;
    }
    const a = local.getAudioTracks()[0] ?? null;
    const v = local.getVideoTracks()[0] ?? null;
    if (this.audioTx) {
      this.audioTx.direction = "sendrecv";
      void this.audioTx.sender.replaceTrack(a);
      this.audioTx.sender.setStreams?.(local);
    }
    if (this.videoTx) {
      this.videoTx.direction = "sendrecv";
      void this.videoTx.sender.replaceTrack(v);
      this.videoTx.sender.setStreams?.(local);
      void this.capVideo();
    }
  }

  private async onCandidate(c: RTCIceCandidateInit | null) {
    const pc = this.pc;
    if (!pc || !c) return;
    if (!pc.remoteDescription) {
      this.pendingCandidates.push(c);
      return;
    }
    try {
      await pc.addIceCandidate(c);
    } catch (e) {
      if (!this.ignoreOffer) console.warn("candidate failed", e);
    }
  }

  /** Swaps the camera track (on, off or the other camera) without renegotiating. */
  async setVideoTrack(track: MediaStreamTrack | null) {
    if (!this.videoTx) return;
    await this.videoTx.sender.replaceTrack(track);
    void this.capVideo();
  }

  /**
   * Caller, while still connecting: send our offer and candidates again. Realtime broadcast is
   * "fire and forget", so on a weak mobile network a message can be lost; repeating is harmless.
   */
  resend() {
    const pc = this.pc;
    if (!pc || this.polite || this.closed) return;
    if (pc.signalingState === "have-local-offer" && pc.localDescription) this.send("desc", pc.localDescription.toJSON(), this.peerDevice);
    for (const c of this.sentCandidates) this.send("cand", c, this.peerDevice);
  }

  /** The connection dropped (network change, tunnel...): the caller asks for a fresh path through the relay. */
  restart() {
    if (!this.pc || this.polite) return;
    try {
      this.pc.restartIce();
    } catch {
      // older browsers: nothing to do, the call will end on "failed"
    }
  }

  close(sendHangup: boolean) {
    if (sendHangup) this.send("hangup", undefined, null);
    this.closed = true;
    try {
      this.pc?.getSenders().forEach((s) => s.track?.stop());
      this.pc?.close();
    } catch {
      // already closed
    }
    this.pc = null;
    const ch = this.channel;
    this.channel = null;
    // Let the hangup leave before the channel goes.
    if (ch) window.setTimeout(() => void supabaseBrowser().removeChannel(ch), sendHangup ? 400 : 0);
  }
}
