"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { I } from "@/app/components/ui/icons";
import { markConversationRead, sendMessage } from "@/lib/actions";
import { t as dict } from "@/lib/i18n";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { FeedPost, Message } from "@/lib/types";

type Props = { conversationId: string; viewerId: string; lang: "fr" | "en"; initial: Message[]; members: FeedPost["author"][] };

export function Chat({ conversationId, viewerId, lang, initial, members }: Props) {
  const t = dict(lang);
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState(false);
  const [, start] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);
  const names = new Map(members.map((m) => [m.id, m.display_name]));
  const isGroup = members.length > 2;

  // Live delivery: new rows in this conversation arrive over Supabase Realtime.
  useEffect(() => {
    const supabase = supabaseBrowser();
    const channel = supabase
      .channel(`conv-${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "politique", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload: { new: Message }) => {
        setMessages((m) => (m.some((x) => x.id === payload.new.id) ? m : [...m.filter((x) => !(x.id.startsWith("tmp-") && x.text === payload.new.text && x.sender_id === payload.new.sender_id)), payload.new]));
        if (payload.new.sender_id !== viewerId) void markConversationRead(conversationId);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, viewerId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  function send() {
    const body = text.trim();
    if (!body) return;
    setError(false);
    const tmp: Message = { id: `tmp-${Date.now()}`, conversation_id: conversationId, sender_id: viewerId, text: body, media: [], created_at: new Date().toISOString(), deleted_at: null };
    setMessages((m) => [...m, tmp]);
    setText("");
    start(async () => {
      const r = await sendMessage(conversationId, body);
      if (!r.ok) {
        setError(true);
        setMessages((m) => m.filter((x) => x.id !== tmp.id));
        setText(body);
      }
    });
  }

  let lastDay = "";
  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-4" role="log" aria-live="polite">
        {messages.length === 0 && <p className="py-10 text-center text-[15px] text-muted">{t.messages.noMessages}</p>}
        <ul className="flex flex-col gap-1.5">
          {messages.map((m) => {
            const mine = m.sender_id === viewerId;
            const day = new Date(m.created_at).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long" });
            const showDay = day !== lastDay;
            lastDay = day;
            return (
              <li key={m.id} className="flex flex-col">
                {showDay && <span className="my-3 self-center text-[12px] font-semibold text-muted">{day}</span>}
                <div className={`max-w-[80%] ${mine ? "self-end" : "self-start"}`}>
                  {isGroup && !mine && <span className="ml-3 text-[12px] text-muted">{names.get(m.sender_id)}</span>}
                  <p className={`whitespace-pre-wrap break-words rounded-3xl px-4 py-2 text-[15px] leading-snug ${mine ? "rounded-br-md bg-green text-white" : "rounded-bl-md bg-paper text-ink"} ${m.id.startsWith("tmp-") ? "opacity-70" : ""}`}>{m.text}</p>
                  <span className={`mt-0.5 block text-[11px] text-muted ${mine ? "text-right" : ""}`}>{new Date(m.created_at).toLocaleTimeString(lang === "fr" ? "fr-FR" : "en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </li>
            );
          })}
        </ul>
        <div ref={bottom} />
      </div>
      {error && <p role="alert" className="px-4 pb-1 text-[13px] font-medium text-orange">{t.common.error}</p>}
      <form
        className="flex items-end gap-2 border-t border-line px-3 py-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <label className="sr-only" htmlFor="msg">{t.messages.placeholder}</label>
        <textarea
          id="msg"
          rows={1}
          value={text}
          maxLength={4000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={t.messages.placeholder}
          className="max-h-32 min-h-[44px] flex-1 resize-none rounded-3xl border border-line bg-paper px-4 py-2.5 text-[15px] focus:border-green focus:outline-none"
        />
        <button type="submit" aria-label={t.messages.send} disabled={!text.trim()} className="btn-primary h-11 w-11 flex-none !px-0">
          <I.send className="h-5 w-5" />
        </button>
      </form>
    </>
  );
}
