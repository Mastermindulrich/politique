/* eslint-disable @next/next/no-img-element */
export function Avatar({ src, name, size = 40, className = "" }: { src: string | null | undefined; name: string; size?: number; className?: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const style = { width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.36)) };
  if (src) {
    return <img src={src} alt="" width={size} height={size} loading="lazy" className={`flex-none rounded-full bg-paper object-cover outline outline-1 -outline-offset-1 outline-black/[0.06] ${className}`} style={style} />;
  }
  return (
    <span aria-hidden="true" className={`flex flex-none select-none items-center justify-center rounded-full bg-green-soft font-bold text-green-deep ${className}`} style={style}>
      {initials || "?"}
    </span>
  );
}
