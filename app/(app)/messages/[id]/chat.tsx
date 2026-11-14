"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { NameBadge } from "@/app/components/ui/badge";
import { I } from "@/app/components/ui/icons";
import { markConversationRead, sendMessage } from "@/lib/actions";
import { DM_MAX_FILES, DM_URL_TTL, attachmentsOf, isVideo } from "@/lib/dm-media";
import { prepare, removeUploaded, signPaths, tooBig, upload } from "@/lib/dm-upload";
import { t as dict } from "@/lib/i18n";
import { supabaseBrowser } from "@/lib/supabase/client";
import { type VoiceNote, useVoiceRecorder, voiceSupported } from "@/lib/voice-recorder";
import { VoicePanel } from "./voice-panel";
import type { DmAttachment, FeedPost, Message } from "@/lib/types";
import { Lightbox, MessageAttachments } from "./attachments";
import { TypingBubble } from "./typing";

type Props = { conversationId: string; viewerId: string; lang: "fr" | "en"; initial: Message[]; initialUrls: Record<string, string>; members: FeedPost["author"][] };

/** An attachment waiting in the tray above the message box. */
type Draft = { key: string; preview: string; name: string; kind: DmAttachment["type"]; status: "uploading" | "done" | "error"; att?: DmAttachment; file: File };

/** How long a "typing" signal stays on screen without a new one. */
const TYPING_TTL = 4500;
const TYPING_EVERY = 2500;
type Typing = { kind: "text" | "voice"; until: number };

const samePaths = (a: unknown, b: unknown) => attachmentsOf(a).map((x) => x.path).join("|") === attachmentsOf(b).map((x) => x.path).join("|");

export function Chat({ conversationId, viewerId, lang, initial, initialUrls, members }: Props) {
  const t = dict(lang);
  const [messages, setMessages] = useState(initial);
  const [urls, setUrls] = useState<Record<string, string>>(initialUrls);
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [menu, setMenu] = useState(false);
  const [touch, setTouch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<DmAttachment | null>(null);
  const [, start] = useTransition();
  const log = useRef<HTMLDivElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [typing, setTyping] = useState<Record<string, Typing>>({});
  const [canVoice, setCanVoice] = useState(false);
  const [sendingVoice, setSendingVoice] = useState(false);
  const channelRef = useRef<ReturnType<ReturnType<typeof supabaseBrowser>["channel"]> | null>(null);
  const lastTyping = useRef(0);
  const byId = new Map(members.map((m) => [m.id, m]));
  const isGroup = members.length > 2;

  // The camera choice only makes sense on phones and tablets; a desktop shows the file picker anyway.
  useEffect(() => {
    setTouch(window.matchMedia("(pointer: coarse)").matches);
    setCanVoice(voiceSupported());
  }, []);

  // Live delivery: new rows in this conversation arrive over Supabase Realtime.
  useEffect(() => {
    const supabase = supabaseBrowser();
    const channel = supabase
      .channel(`conv-${conversationId}`, { config: { broadcast: { self: false } } })
      // "Typing" and "recording a voice note" signals: ephemeral, never stored.
      .on("broadcast", { event: "typing" }, ({ payload }: { payload: { user_id?: string; kind?: string } }) => {
        const uid = payload?.user_id;
        if (!uid || uid === viewerId) return;
        setTyping((t) => {
          const next = { ...t };
          if (payload.kind === "stop") delete next[uid];
          else next[uid] = { kind: payload.kind === "voice" ? "voice" : "text", until: Date.now() + TYPING_TTL };
          return next;
        });
      })
      .on("postgres_changes", { event: "INSERT", schema: "politique", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload: { new: Message }) => {
        const row = payload.new;
        setMessages((m) => {
          if (m.some((x) => x.id === row.id)) return m;
          const rest = m.filter((x) => !(x.id.startsWith("tmp-") && x.sender_id === row.sender_id && x.text === row.text && samePaths(x.media, row.media)));
          return [...rest, row];
        });
        const missing = attachmentsOf(row.media).map((a) => a.path);
        if (missing.length) {
          void signPaths(missing, DM_URL_TTL).then((signed) => setUrls((u) => ({ ...signed, ...u })));
        }
        if (row.sender_id !== viewerId) {
          void markConversationRead(conversationId);
          setTyping((t) => {
            if (!t[row.sender_id]) return t;
            const next = { ...t };
            delete next[row.sender_id];
            return next;
          });
        }
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [conversationId, viewerId]);

  // Signals expire on their own if the other person stops without sending.
  const typingNow = Object.entries(typing).filter(([, v]) => v.until > Date.now());
  useEffect(() => {
    if (!Object.keys(typing).length) return;
    const id = window.setInterval(() => setTyping((t) => {
      const now = Date.now();
      const live = Object.entries(t).filter(([, v]) => v.until > now);
      return live.length === Object.keys(t).length ? t : Object.fromEntries(live);
    }), 1000);
    return () => window.clearInterval(id);
  }, [typing]);

  const signal = useCallback((kind: "text" | "voice" | "stop", force = false) => {
    const ch = channelRef.current;
    if (!ch) return;
    const now = Date.now();
    if (kind !== "stop" && !force && now - lastTyping.current < TYPING_EVERY) return;
    lastTyping.current = kind === "stop" ? 0 : now;
    void ch.send({ type: "broadcast", event: "typing", payload: { user_id: viewerId, kind } });
  }, [viewerId]);

  const toBottom = useCallback(() => {
    // Scroll the message list itself, never the page (scrollIntoView also moved the whole page on iPhone).
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, []);
  useEffect(toBottom, [messages.length, toBottom]);
  // The "…" bubble appearing keeps the bottom in view when the reader is already there.
  const typingCount = typingNow.length;
  useEffect(() => {
    const el = log.current;
    if (typingCount && el && el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight;
  }, [typingCount]);

  // A photo that finishes loading near the bottom keeps the newest message in view.
  const onMediaLoaded = useCallback(() => {
    const el = log.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 480) el.scrollTop = el.scrollHeight;
  }, []);

  async function addFiles(list: FileList | null) {
    setMenu(false);
    if (!list?.length) return;
    setError(null);
    const room = DM_MAX_FILES - drafts.length;
    const files = Array.from(list);
    if (files.length > room) setError(t.messages.tooMany);
    for (const file of files.slice(0, Math.max(0, room))) {
      if (isVideo(file.type, file.name)) {
        setError(t.messages.noVideo);
        continue;
      }
      const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const p = await prepare(file);
      if (tooBig(p)) {
        setError(`${file.name} : ${t.messages.tooBig}`);
        continue;
      }
      const preview = URL.createObjectURL(p.blob);
      setDrafts((d) => [...d, { key, preview, name: p.name, kind: p.kind, status: "uploading", file }]);
      void upload(conversationId, viewerId, p)
        .then((att) => setDrafts((d) => d.map((x) => (x.key === key ? { ...x, status: "done", att } : x))))
        .catch(() => setDrafts((d) => d.map((x) => (x.key === key ? { ...x, status: "error" } : x))));
    }
  }

  function retry(key: string) {
    const d = drafts.find((x) => x.key === key);
    if (!d) return;
    setDrafts((all) => all.filter((x) => x.key !== key));
    const dt = new DataTransfer();
    dt.items.add(d.file);
    URL.revokeObjectURL(d.preview);
    void addFiles(dt.files);
  }

  function removeDraft(key: string) {
    setDrafts((d) => {
      const x = d.find((y) => y.key === key);
      if (x) {
        URL.revokeObjectURL(x.preview);
        if (x.att) void removeUploaded(x.att.path);
      }
      return d.filter((y) => y.key !== key);
    });
  }

  const uploading = drafts.some((d) => d.status === "uploading");
  const ready = drafts.filter((d) => d.status === "done" && d.att);
  const canSend = !uploading && (text.trim().length > 0 || ready.length > 0);

  async function sendVoice(note: VoiceNote | null) {
    signal("stop");
    if (!note || note.duration < 0.8) return;
    setSendingVoice(true);
    setError(null);
    try {
      const ext = note.mime.includes("mp4") || note.mime.includes("aac") ? "m4a" : note.mime.includes("ogg") ? "ogg" : "webm";
      const base = await upload(conversationId, viewerId, { blob: note.blob, name: `vocal-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}.${ext}`, mime: note.mime, kind: "file" });
      const att: DmAttachment = { ...base, voice: true, duration: Math.round(note.duration * 10) / 10, peaks: note.peaks };
      setUrls((u) => ({ ...u, [att.path]: URL.createObjectURL(note.blob) }));
      const tmp: Message = { id: `tmp-${Date.now()}`, conversation_id: conversationId, sender_id: viewerId, text: "", media: [att], created_at: new Date().toISOString(), deleted_at: null };
      setMessages((m) => [...m, tmp]);
      const r = await sendMessage(conversationId, "", [att]);
      if (!r.ok) {
        setMessages((m) => m.filter((x) => x.id !== tmp.id));
        void removeUploaded(att.path);
        setError(t.common.error);
        return;
      }
      const id = r.data!.id;
      setMessages((m) => (m.some((x) => x.id === id) ? m.filter((x) => x.id !== tmp.id) : m.map((x) => (x.id === tmp.id ? { ...x, id } : x))));
    } catch {
      setError(t.messages.uploadFailed);
    } finally {
      setSendingVoice(false);
    }
  }

  const voice = useVoiceRecorder((note) => void sendVoice(note));
  const recording = voice.state !== "idle";
  // Tell the other side every few seconds that a voice note is being recorded (not while paused).
  useEffect(() => {
    if (voice.state !== "recording") return;
    signal("voice", true);
    const id = window.setInterval(() => signal("voice", true), TYPING_EVERY);
    return () => window.clearInterval(id);
  }, [voice.state, signal]);

  async function startVoice() {
    setMenu(false);
    setError(null);
    try {
      await voice.start();
    } catch (e) {
      setError((e as Error).message === "denied" ? t.messages.micDenied : t.messages.noVoice);
    }
  }

  function send() {
    if (!canSend) return;
    const body = text.trim();
    const media = ready.map((d) => d.att!);
    const sent = drafts;
    setError(null);
    signal("stop");
    // The sender sees their own photos at once from the local copies.
    setUrls((u) => {
      const next = { ...u };
      for (const d of ready) if (!next[d.att!.path]) next[d.att!.path] = d.preview;
      return next;
    });
    const tmp: Message = { id: `tmp-${Date.now()}`, conversation_id: conversationId, sender_id: viewerId, text: body, media, created_at: new Date().toISOString(), deleted_at: null };
    setMessages((m) => [...m, tmp]);
    setText("");
    setDrafts((d) => d.filter((x) => x.status === "error"));
    start(async () => {
      const r = await sendMessage(conversationId, body, media);
      if (!r.ok) {
        setError(t.common.error);
        setMessages((m) => m.filter((x) => x.id !== tmp.id));
        setText(body);
        setDrafts((d) => [...sent.filter((x) => x.status === "done"), ...d]);
        return;
      }
      const id = r.data!.id;
      setMessages((m) => (m.some((x) => x.id === id) ? m.filter((x) => x.id !== tmp.id) : m.map((x) => (x.id === tmp.id ? { ...x, id } : x))));
    });
  }

  let lastDay = "";
  return (
    <>
      <div ref={log} data-chat-log className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4" role="log" aria-live="polite">
        {messages.length === 0 && <p className="py-10 text-center text-[15px] text-muted">{t.messages.noMessages}</p>}
        <ul className="flex flex-col gap-1.5">
          {messages.map((m) => {
            const mine = m.sender_id === viewerId;
            const day = new Date(m.created_at).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long" });
            const showDay = day !== lastDay;
            lastDay = day;
            const atts = attachmentsOf(m.media);
            const pending = m.id.startsWith("tmp-");
            return (
              <li key={m.id} className="flex flex-col">
                {showDay && <span className="my-3 self-center text-[12px] font-semibold text-muted">{day}</span>}
                <div className={`flex max-w-[80%] flex-col gap-1 ${mine ? "items-end self-end" : "items-start self-start"} ${pending ? "opacity-70" : ""}`}>
                  {isGroup && !mine && byId.get(m.sender_id) && <span className="ml-3 inline-flex items-center gap-1 text-[12px] text-muted">{byId.get(m.sender_id)!.display_name}<NameBadge p={byId.get(m.sender_id)!} size={12} lang={lang} /></span>}
                  {atts.length > 0 && <MessageAttachments items={atts} urls={urls} mine={mine} lang={lang} onOpen={setViewing} onLoaded={onMediaLoaded} />}
                  {m.text && <p className={`whitespace-pre-wrap break-words rounded-3xl px-4 py-2 text-[15px] leading-snug ${mine ? "rounded-br-md bg-green text-white" : "rounded-bl-md bg-paper text-ink"}`}>{m.text}</p>}
                  <span className={`block text-[11px] text-muted ${mine ? "text-right" : ""}`}>{new Date(m.created_at).toLocaleTimeString(lang === "fr" ? "fr-FR" : "en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </li>
            );
          })}
        </ul>
        {typingNow.length > 0 && (
          <TypingBubble
            names={isGroup ? typingNow.map(([id]) => byId.get(id)?.display_name ?? "").filter(Boolean) : []}
            voice={typingNow.every(([, v]) => v.kind === "voice")}
            lang={lang}
          />
        )}
      </div>
      {error && <p role="alert" className="px-4 pb-1 text-[13px] font-medium text-orange">{error}</p>}

      {drafts.length > 0 && (
        <ul className="flex flex-none gap-2 overflow-x-auto border-t border-line bg-bg px-3 pt-2" aria-label={t.messages.attach}>
          {drafts.map((d) => (
            <li key={d.key} className="relative h-20 w-20 flex-none overflow-hidden rounded-2xl border border-line bg-paper">
              {d.kind === "image" ? (
                <img src={d.preview} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-center text-muted">
                  <I.file className="h-6 w-6" />
                  <span className="line-clamp-2 break-all text-[10px] leading-tight">{d.name}</span>
                </div>
              )}
              {d.status === "uploading" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40" aria-label={t.messages.uploading}>
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                </div>
              )}
              {d.status === "error" && (
                <button type="button" onClick={() => retry(d.key)} className="absolute inset-0 flex items-center justify-center bg-black/60 text-[11px] font-semibold text-white">
                  {t.messages.retry}
                </button>
              )}
              <button type="button" aria-label={`${t.messages.remove} ${d.name}`} onClick={() => removeDraft(d.key)} className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white">
                <I.x className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {menu && (
        <div className={`flex flex-none gap-2 overflow-x-auto bg-bg px-3 pt-2 ${drafts.length ? "" : "border-t border-line"}`}>
          <button type="button" onClick={() => libraryRef.current?.click()} className="flex flex-none items-center gap-2 rounded-full border border-line bg-paper px-3.5 py-2 text-[14px] font-semibold text-ink">
            <I.image className="h-5 w-5 text-green-deep" />{t.messages.library}
          </button>
          {touch && (
            <button type="button" onClick={() => cameraRef.current?.click()} className="flex flex-none items-center gap-2 rounded-full border border-line bg-paper px-3.5 py-2 text-[14px] font-semibold text-ink">
              <I.camera className="h-5 w-5 text-green-deep" />{t.messages.camera}
            </button>
          )}
          <button type="button" onClick={() => fileRef.current?.click()} className="flex flex-none items-center gap-2 rounded-full border border-line bg-paper px-3.5 py-2 text-[14px] font-semibold text-ink">
            <I.file className="h-5 w-5 text-green-deep" />{t.messages.file}
          </button>
        </div>
      )}

      <input ref={libraryRef} type="file" accept="image/*" multiple hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
      <input ref={fileRef} type="file" multiple hidden onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />

      <form
        className={`chat-composer relative flex flex-none items-end gap-2 bg-bg px-3 pt-2 ${drafts.length || menu ? "" : "border-t border-line"}`}
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        {recording ? (
          <VoicePanel voice={voice} lang={lang} onCancel={() => { voice.cancel(); signal("stop"); }} onSend={async () => void sendVoice(await voice.stop())} />
        ) : (
          <>
        <button
          type="button"
          aria-label={menu ? t.messages.attachClose : t.messages.attach}
          aria-expanded={menu}
          disabled={drafts.length >= DM_MAX_FILES}
          onClick={() => setMenu((x) => !x)}
          className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-green-deep hover:bg-green-soft disabled:opacity-40"
        >
          <I.plus className={`h-6 w-6 transition-transform ${menu ? "rotate-45" : ""}`} />
        </button>
        <label className="sr-only" htmlFor="msg">{t.messages.placeholder}</label>
        <textarea
          id="msg"
          rows={1}
          value={text}
          maxLength={4000}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value.trim()) signal("text");
            else signal("stop");
          }}
          onFocus={() => setMenu(false)}
          onBlur={() => !text.trim() && signal("stop")}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={t.messages.placeholder}
          className="max-h-32 min-h-[44px] min-w-0 flex-1 resize-none rounded-3xl border border-line bg-paper px-4 py-2.5 text-[16px] focus:border-green focus:outline-none"
        />
        {canVoice && !text.trim() && !drafts.length ? (
          <button type="button" aria-label={t.messages.record} onClick={startVoice} disabled={sendingVoice} className="btn-primary h-11 w-11 flex-none !px-0">
            {sendingVoice ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <I.mic className="h-5 w-5" />}
          </button>
        ) : (
          <button type="submit" aria-label={t.messages.send} disabled={!canSend} className="btn-primary h-11 w-11 flex-none !px-0">
            {uploading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <I.send className="h-5 w-5" />}
          </button>
        )}
          </>
        )}
      </form>

      {viewing && urls[viewing.path] && <Lightbox a={viewing} url={urls[viewing.path]} lang={lang} onClose={() => setViewing(null)} />}
    </>
  );
}
