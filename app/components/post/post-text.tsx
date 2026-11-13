import Link from "next/link";

const TOKEN = /(https?:\/\/[^\s<]+[^\s<.,;:!?)"'])|((?:^|[^\w])#[\p{L}\p{N}_]{2,50})|((?:^|[^\w])@[a-z0-9_]{3,20})/giu;

/** Renders post text with clickable links, #hashtags and @mentions. Server-safe. */
export function PostText({ text, className = "" }: { text: string; className?: string }) {
  const out: React.ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(TOKEN)) {
    const start = m.index ?? 0;
    let token = m[0];
    let lead = "";
    if (!m[1] && /^[^\w#@]/.test(token)) {
      lead = token[0];
      token = token.slice(1);
    }
    if (start + lead.length > last) out.push(text.slice(last, start + lead.length));
    if (m[1]) {
      let href = token;
      let label = token.replace(/^https?:\/\//, "");
      if (label.length > 40) label = label.slice(0, 37) + "…";
      out.push(
        <a key={k++} href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-green-deep hover:underline">
          {label}
        </a>,
      );
    } else if (token.startsWith("#")) {
      out.push(
        <Link key={k++} href={`/t/${encodeURIComponent(token.slice(1).toLowerCase())}`} className="text-green-deep hover:underline">
          {token}
        </Link>,
      );
    } else {
      out.push(
        <Link key={k++} href={`/u/${token.slice(1).toLowerCase()}`} className="text-green-deep hover:underline">
          {token}
        </Link>,
      );
    }
    last = start + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <p className={`post-text whitespace-pre-wrap break-words text-[15px] leading-snug ${className}`}>{out}</p>;
}
