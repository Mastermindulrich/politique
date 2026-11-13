import type { Content } from "@/lib/content";
import { Verified } from "./icons";

type Mock = Content["mock"];

function Avatar({ initials, tone }: { initials: string; tone: "green" | "orange" | "grey" }) {
  const bg = tone === "green" ? "bg-green-soft text-green-deep" : tone === "orange" ? "bg-orange-soft text-orange" : "bg-paper text-muted";
  return (
    <div aria-hidden="true" className={`flex h-10 w-10 flex-none items-center justify-center rounded-full text-sm font-bold ${bg}`}>
      {initials}
    </div>
  );
}

function Head({ name, handle, role, time, badge, verified }: { name: string; handle: string; role: string; time: string; badge?: string; verified: string }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-x-1.5 text-[15px] leading-tight">
        <span className="font-bold text-ink">{name}</span>
        {badge && <Verified color={badge} title={verified} />}
        <span className="text-muted">{handle}</span>
        <span className="text-muted">·</span>
        <span className="text-muted">{time}</span>
      </div>
      <div className="mt-0.5 text-[13px] text-muted">{role}</div>
    </div>
  );
}

function Actions({ replies, reposts, likes }: { replies: string; reposts: string; likes: string }) {
  const items = [
    { d: "M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z", n: replies },
    { d: "M17 2.5 21 6.5l-4 4M3 11V8.5a2 2 0 0 1 2-2h16M7 21.5l-4-4 4-4M21 13v2.5a2 2 0 0 1-2 2H3", n: reposts },
    { d: "M12 20.5s-8-4.6-8-10.4A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 8 3.1c0 5.8-8 10.4-8 10.4z", n: likes },
  ];
  return (
    <div aria-hidden="true" className="mt-3 flex max-w-xs justify-between text-[13px] text-muted">
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d={it.d} />
          </svg>
          {it.n}
        </span>
      ))}
    </div>
  );
}

export default function MockFeed({ m }: { m: Mock }) {
  return (
    <div aria-hidden="true" className="select-none overflow-hidden rounded-3xl border border-line bg-white shadow-[0_24px_60px_-30px_rgba(22,24,28,0.35)]">
      <div className="flex border-b border-line">
        {m.tabs.map((tab, i) => (
          <div key={tab} className="flex flex-1 flex-col items-center gap-2.5 pt-3.5 text-[14px]">
            <span className={i === 0 ? "font-bold text-ink" : "font-medium text-muted"}>{tab}</span>
            <span className={`h-1 w-14 rounded-full ${i === 0 ? "bg-green" : "bg-transparent"}`} />
          </div>
        ))}
      </div>

      <article className="flex gap-3 border-b border-line p-4">
        <Avatar initials="AK" tone="green" />
        <div className="min-w-0 flex-1">
          <Head name={m.mp.name} handle={m.mp.handle} role={m.mp.role} time={m.mp.time} badge="#0A7A4A" verified={m.verified} />
          <p className="mt-2 text-[15px] leading-snug text-ink">{m.mp.text}</p>
          <Actions replies={m.mp.replies} reposts={m.mp.reposts} likes={m.mp.likes} />
        </div>
      </article>

      <article className="flex gap-3 border-b border-line p-4">
        <Avatar initials="YK" tone="grey" />
        <div className="min-w-0 flex-1">
          <Head name={m.poll.name} handle={m.poll.handle} role={m.poll.role} time={m.poll.time} verified={m.verified} />
          <p className="mt-2 text-[15px] font-semibold leading-snug text-ink">{m.poll.question}</p>
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {m.poll.options.map((o, i) => (
              <li key={o.label} className="relative h-9 overflow-hidden rounded-lg border border-line text-[14px]">
                <span className={`absolute inset-y-0 left-0 ${i === 0 ? "bg-green-soft" : "bg-paper"}`} style={{ width: `${o.pct}%` }} />
                <span className="relative flex h-full items-center justify-between px-3">
                  <span className={i === 0 ? "font-bold text-ink" : "font-medium text-ink"}>{o.label}</span>
                  <span className="font-semibold text-muted">{o.pct} %</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 text-[13px] text-muted">{m.poll.votes}</div>
        </div>
      </article>

      <article className="flex gap-3 p-4">
        <Avatar initials="FM" tone="orange" />
        <div className="min-w-0 flex-1">
          <Head name={m.video.name} handle={m.video.handle} role={m.video.role} time={m.video.time} badge="#F07C00" verified={m.verified} />
          <p className="mt-2 text-[15px] leading-snug text-ink">{m.video.text}</p>
          <div className="relative mt-3 flex aspect-[16/9] items-center justify-center overflow-hidden rounded-xl bg-ink">
            <span className="absolute left-3 top-3 rounded-md bg-white/15 px-2 py-0.5 text-[12px] font-semibold text-white">{m.video.caption}</span>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95">
              <svg viewBox="0 0 24 24" className="ml-1 h-6 w-6 fill-ink">
                <path d="M7 4.5v15l12-7.5z" />
              </svg>
            </span>
            <span className="absolute bottom-3 right-3 rounded-md bg-ink/80 px-2 py-0.5 text-[12px] font-semibold text-white">{m.video.duration}</span>
          </div>
        </div>
      </article>
    </div>
  );
}
