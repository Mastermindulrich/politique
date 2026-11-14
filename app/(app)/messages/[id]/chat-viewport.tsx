"use client";

import { useEffect, useRef } from "react";

/**
 * Phones: the conversation takes the whole visible screen, above the bottom bar, like a chat app.
 * Its height follows the *visible* viewport (window.visualViewport), so when the keyboard opens
 * the message box sits right on top of it instead of sliding under the bar or off screen.
 * Wider screens keep the normal column layout.
 */
export function ChatViewport({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const vv = window.visualViewport;
    const phone = window.matchMedia("(max-width: 639px)");
    const html = document.documentElement;

    function fit() {
      if (!el) return;
      if (!phone.matches) {
        el.style.removeProperty("height");
        el.style.removeProperty("transform");
        html.classList.remove("chat-open");
        return;
      }
      html.classList.add("chat-open");
      const h = vv ? vv.height : window.innerHeight;
      // iOS pans the page when the keyboard opens; follow the visible area.
      const top = vv ? vv.offsetTop : 0;
      el.style.height = `${h}px`;
      el.style.transform = top ? `translateY(${top}px)` : "";
      // Keyboard open: the home-indicator gap is covered by the keyboard, so drop it.
      el.dataset.keyboard = window.innerHeight - h > 120 ? "open" : "closed";
      // Keep the newest message in view as the space changes.
      const log = el.querySelector<HTMLElement>("[data-chat-log]");
      if (log && log.scrollHeight - log.scrollTop - log.clientHeight < 200) log.scrollTop = log.scrollHeight;
    }

    fit();
    vv?.addEventListener("resize", fit);
    vv?.addEventListener("scroll", fit);
    window.addEventListener("resize", fit);
    phone.addEventListener("change", fit);
    return () => {
      vv?.removeEventListener("resize", fit);
      vv?.removeEventListener("scroll", fit);
      window.removeEventListener("resize", fit);
      phone.removeEventListener("change", fit);
      html.classList.remove("chat-open");
    };
  }, []);

  return (
    <div ref={ref} data-keyboard="closed" className="chat-viewport fixed inset-x-0 top-0 z-50 flex h-[100dvh] flex-col bg-bg sm:static sm:z-auto sm:h-screen">
      {children}
    </div>
  );
}
